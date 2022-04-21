---
title: "Building a Web Server in C"
date: 2022-04-21T09:00:08-03:00
---

A few weeks ago I deploy the initial version of [Trackear](https://www.trackear.app),
a simple application for freelancers to track their working time and
generate reports/invoices. But there is a catch, the application is built
using plain good ol' C and Javascript (no frameworks, libraries, nothing)

In this post however, I'm going to focus on the backend side, since I consider
it to be the most interesting.

## A few notes

What I like the most about C is that, it's a language that forces you, or at
least I feel that way, to be very specific with certain things. For instance,
how long is this array gonna be. You could do some memory management to make it
"dynamic" but I have found that most of the cases, using a fixed constrain solves
the problem quite nicely. Having said that, this server is meant to run on 
Ubuntu and just Ubuntu. It only supports POST requests (since I'm not interested
in covering the entire options) and only a few KBs can be used for requests
and responses. That's it, that's all I need.

## Building a HTTP server from scratch

Now, implementing a HTTP server from scratch isn't that difficult, you just
need a few sockets using the TCP protocol and you are pretty much good to go.
The HTTP protocol by itself is not complex either. Requests look like this:

```
GET /index.html HTTP/1.1
Host: www.example.com
Referer: www.google.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:45.0) Gecko/20100101 Firefox/45.0
Connection: keep-alive

```

And the responses from your server like this:

```
HTTP/1.1 200 OK
Content-Type: text/html

Your content here.
```

There are a few more headers you can send (`Content-Length` for example) but
are not strictly necessary.

So let's begin with a simple struct that will represent a new connection/request.

```c
// server.c

#define KB(x) ((x) * 1024)

typedef unsigned char byte;

struct unix_socket {
    int fd;
    int being_used;
    byte read[KB(16)];
    byte write[KB(16)];
    size_t received;
    size_t to_write;
    size_t written;
};
```

## The initial code for server socket

There isn't a lot to be seen here, I think it's the same code every time
I need to write a server socket so I'll spare the details:

```c
// server.c

#include <assert.h>     // assert
#include <fcntl.h>      // fcntl, F_GETFL, F_SETFL, O_NONBLOCK
#include <unistd.h>     // close
#include <sys/socket.h> // socket
#include <arpa/inet.h>  // sockaddr_in, INADDR_ANY, htons

#define KB(x) ((x) * 1024)
#define MAX_CONNECTIONS (512)

typedef unsigned char byte;

struct unix_socket {
    int fd;
    int being_used;
    byte read[KB(16)];
    byte write[KB(16)];
    size_t received;
    size_t to_write;
};

static int unix_socket_set_non_block(int fd)
{
    int flags = 0;

    flags = fcntl(fd, F_GETFL, 0);
    flags = flags < 0 ? 0 : flags;

    return fcntl(fd, F_SETFL, flags | O_NONBLOCK) != -1;
}

static int unix_socket_reusable(int fd)
{
    int reusable_enable = 0;
    reusable_enable = 1;
    return setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reusable_enable, 4) == 0;
}

int unix_socket_server(int *dest, short port)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;

    assert(dest);

    *dest = socket(AF_INET, SOCK_STREAM, 0);
    if (*dest == -1) goto abort;
    if (!unix_socket_set_non_block(*dest)) goto abort;
    if (!unix_socket_reusable(*dest)) goto abort;

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);

    address_p = (struct sockaddr *) &address;

    if (bind(*dest, address_p, sizeof(address)) == -1) goto abort;
    if (listen(*dest, MAX_CONNECTIONS) == -1) goto abort;

    return 1;

abort:
    close(*dest);
    return 0;
}
```

Good, now we can start a new server with simply:

```c
// main.c

#include <errno.h>
#include <string.h>
#include <stdio.h>
#include "server.c"

int main(int argc, char **argv)
{
    int fd = 0;
    if (!unix_socket_server(&fd, 8080)) {
        printf("there was an error starting the server.\n");
        printf("%s.\n", strerror(errno));
        return 1;
    }
    printf("server started.\n");
    return 0;
}
```

Compile, and we should be good to go.

```bash
gcc main.c
./a.out
server started
```

## Listening for connections/clients

To listen for new requests we have a few options. We can use blocking connections,
so only one connection gets handled at a time; we can use `fork`, this way we 
make sure if a connection fails the rest doesn't get affected; or, we can use 
non blocking connections. For this last one, `epoll` comes in handy.

For some reason, I went with non blocking connections so that's what I'm
going to be showing here, but in the future, I may re-write it to use `fork`.

First off, let's write the `accept` function for the socket:

```c
static void unix_socket_close_and_free(struct unix_socket *src)
{
    assert(src);
    close(src->fd);
    *src = (struct unix_socket) { 0 };
}

static int unix_socket_accept(struct unix_socket *client, int server_fd, int epoll_fd)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;
    socklen_t addrlen = 0;

    struct epoll_event event = { 0 };

    assert(client);

    address_p = (struct sockaddr *) &address;

    client->fd = accept(server_fd, address_p, &addrlen);
    client->used = 1;

    if (client->fd == -1) goto abort;
    if (!unix_socket_set_non_block(client->fd)) goto abort;

    event.events = EPOLLIN | EPOLLOUT | EPOLLET;
    event.data.ptr = client;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, client->fd, &event) == -1) goto abort;

    return 1;

abort:
    unix_socket_close_and_free(client);
    return 0;
}
```

Good, now let's see how can we use it:

```c
int unix_socket_listen(int fd)
{
    static struct epoll_event events[MAX_CONNECTIONS] = { 0 };
    static struct unix_socket clients[MAX_CONNECTIONS] = { 0 };

    int epoll_fd = 0;
    struct epoll_event event = { 0 };
    int ev_count = 0;

    struct unix_socket *client = 0;
    ssize_t read = 0;
    ssize_t written = 0;

    epoll_fd = epoll_create1(0);
    if (epoll_fd == -1) goto abort;

    event.events = EPOLLIN | EPOLLET;
    event.data.fd = fd;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, fd, &event) == -1) goto abort;

    while (1) {
        ev_count = epoll_wait(epoll_fd, events, MAX_CONNECTIONS, -1);
        if (ev_count == -1) goto abort;
        for (int i = 0; i < ev_count; i += 1) {
            if (fd == events[i].data.fd) {
                unix_get_free_socket(&client, clients, MAX_CONNECTIONS);
                if (!unix_socket_accept(client, fd, epoll_fd)) {
                    printf("unable to accept new connection.\n");
                }
                continue;
            }

            // here we will handle requests (read and writes)
        }
    }

abort:
    close(epoll_fd);
    close(fd);
    return 0;
}
```

Ok, now we have to write the `unix_get_free_socket` function, that's an easy one:

```c
static void unix_get_free_socket(struct unix_socket **dest, struct unix_socket *src, size_t src_len)
{
    assert(dest);
    assert(src);
    for (size_t i = 0; i < src_len; i += 1) {
        if (!src[i].being_used) {
            *dest = &src[i];
            return;
        }
    }
    assert(0 && "seems like you ran out of free clients. you may want to increase the MAX_CONNECTIONS constant.");
}

```

Simple, go through all the clients and found one that's not being used.

## Handling requests

Now that we are accepting connections, we need to read requests and write
responses. In order to do that, we will be using `recv` and `send`.

Let's replace the comment `here we will handle requests` from the previous
chunk of code with:


```c
client = (struct unix_socket *) events[i].data.ptr;

if ((events[i].events & EPOLLOUT) == EPOLLOUT) {
    // write;
}
if ((events[i].events & EPOLLIN) != EPOLLIN) {
    // if there are nothing left to do just jump to the next client.
    continue;
}

read = recv(client->fd, client->read, sizeof(client->read), 0);
switch (read) {
case -1: // error
    printf("error while reading, closing the connection.\n");
    unix_socket_close_and_free(client);
    break;
case 0: // closed connection
    printf("connection closed as requested by client.\n");
    unix_socket_close_and_free(client);
    break;
default: // successfully read
    client->received = read;
    printf("new request received.\n");
    // handle request.
    break;
}
```

Now let's update our `main.c` to make use of the `unix_socket_listen`:

```c
// main.c

#include <errno.h>
#include <string.h>
#include <stdio.h>
#include "server.c"

int main(int argc, char **argv)
{
    int fd = 0;
    if (!unix_socket_server(&fd, 8080)) {
        printf("there was an error starting the server.\n");
        printf("%s.\n", strerror(errno));
        return 1;
    }
    printf("starting server.\n");
    if (!unix_socket_listen(fd)) {
        printf("there was an error listening for new requests.\n");
        printf("%s.\n", strerror(errno));
        return 1;
    }
    return 0;
}
```

If we compile and run, then visit http://localhost:8080, we will see it's in 
fact working but it doesn't do anything interesting:

```bash
gcc main.c
./a.out
starting server
new connection found
new request received
```

Perfect, let's print out the request with:

```c
printf("%.*s\n", (int) client->received, client->read);
```

And as you can probably see, we are getting a nice HTTP request. Let's go ahead
and finish it up by sending an empty response. After printing the request, let's
use `send` to write the response:

```c
send(client->fd, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nYep, this seems to be working.", sizeof("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nYep, this seems to be working.") - 1, 0);
unix_socket_close_and_free(client);
```

And one more time, if you compile, run it and access to http://localhost:8080 
you will see the response.

## Almost done

So at this point you may say well, it's all good and working, but, there is a 
problem in our code. You see, the TCP protocol is a streaming protocol, it
guarantees that the packets will arrive in order. What it doesn't guarantees 
though, is that the entire HTTP packet (in this example) will arrive all at once,
because again, TCP is a streaming protocol, it doesn't know anything about
packets, just raw bytes in a sequential order.

This mean, our entire HTTP packet can arrive all at once or in chunks, in order,
but still, chunks none the least. Which means, we have to fix the case
were we may receive part of the HTTP packet. Not only that, when we send a 
response, the same case can happen, we may not be able to send the entire response
all at once, but in chunks.

## Response in chunks

Instead of sending the response directly using `send`, we will first copy 
the response to the client's `write` buffer:

```c
client->written = 0;
client->to_write = sizeof("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nYep, this seems to be working.") - 1;
memcpy(client->write, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nYep, this seems to be working.", client->to_write);
```

Now, let's try to use `send`:

```c
written = send(client->fd, client->write, client->to_write, 0);
if (written) {
    client->written += written;
    if (client->written == client->to_write) {
        unix_socket_close_and_free(client);
    }
}
```

Ok but what if only a chunk gets send? This is where `EPOLLOUT` comes in handy:

```c
if ((events[i].events & EPOLLOUT) == EPOLLOUT) {
    written = send(client->fd, client->write + client->written, client->to_write - client->written, 0);
    if (written) {
        client->written += written;
        // if the entire response has been sent, close the connection.
        if (client->written == client->to_write) {
            unix_socket_close_and_free(client);
        }
    }
}
```

And there it is! Now we support sending responses in chunks :) Let's refactor
to use a function:

```c
static void unix_socket_flush_and_close(struct unix_socket *src)
{
    ssize_t written = 0;

    assert(src);

    written = send(
        src->fd,
        src->write + src->written,
        src->to_write - src->written,
        0
    );

    if (written) {
        src->written += written;
        if (src->written == src->to_write) {
            unix_socket_close_and_free(src);
        }
    }
}
```

What about reading in chunks? Well, I think I'm gonna leave that as an 
exercise for the reader.

## Full source code

```c
// main.c

#include <errno.h>
#include <string.h>
#include <stdio.h>
#include "server.c"

int main(int argc, char **argv)
{
    int fd = 0;
    if (!unix_socket_server(&fd, 8080)) {
        printf("there was an error starting the server.\n");
        printf("%s.\n", strerror(errno));
        return 1;
    }
    printf("starting server.\n");
    if (!unix_socket_listen(fd)) {
        printf("there was an error listening for new requests.\n");
        printf("%s.\n", strerror(errno));
        return 1;
    }
    return 0;
}
```

```c
// server.c

#include <assert.h>     // assert
#include <fcntl.h>      // fcntl, F_GETFL, F_SETFL, O_NONBLOCK
#include <errno.h>      // errno
#include <string.h>     // memcpy, strerror
#include <unistd.h>     // close
#include <sys/socket.h> // socket
#include <sys/epoll.h>  // epoll_event, EPOLLIN, EPOLLOUT, EPOLLET, epoll_ctl, epoll_create1
#include <arpa/inet.h>  // sockaddr_in, INADDR_ANY, htons

#define KB(x) ((x) * 1024)
#define MAX_CONNECTIONS (512)

typedef unsigned char byte;

struct unix_socket {
    int fd;
    int being_used;
    byte read[KB(16)];
    byte write[KB(16)];
    size_t received;
    size_t written;
    size_t to_write;
};

static int unix_socket_set_non_block(int fd)
{
    int flags = 0;

    flags = fcntl(fd, F_GETFL, 0);
    flags = flags < 0 ? 0 : flags;

    return fcntl(fd, F_SETFL, flags | O_NONBLOCK) != -1;
}

static int unix_socket_reusable(int fd)
{
    int reusable_enable = 0;
    reusable_enable = 1;
    return setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reusable_enable, 4) == 0;
}

static void unix_get_free_socket(struct unix_socket **dest, struct unix_socket *src, size_t src_len)
{
    assert(dest);
    assert(src);
    for (size_t i = 0; i < src_len; i += 1) {
        if (!src[i].being_used) {
            *dest = &src[i];
            return;
        }
    }
    assert(0 && "seems like you ran out of free clients. you may want to increase the MAX_CONNECTIONS constant.");
}

static void unix_socket_close_and_free(struct unix_socket *src)
{
    assert(src);
    close(src->fd);
    *src = (struct unix_socket) { 0 };
}

static int unix_socket_accept(struct unix_socket *client, int server_fd, int epoll_fd)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;
    socklen_t addrlen = 0;

    struct epoll_event event = { 0 };

    assert(client);

    address_p = (struct sockaddr *) &address;

    client->fd = accept(server_fd, address_p, &addrlen);
    client->being_used = 1;

    if (client->fd == -1) goto abort;
    if (!unix_socket_set_non_block(client->fd)) goto abort;

    event.events = EPOLLIN | EPOLLOUT | EPOLLET;
    event.data.ptr = client;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, client->fd, &event) == -1) goto abort;

    return 1;

abort:
    unix_socket_close_and_free(client);
    return 0;
}

static void unix_socket_flush_and_close(struct unix_socket *src)
{
    ssize_t written = 0;

    assert(src);

    written = send(
        src->fd,
        src->write + src->written,
        src->to_write - src->written,
        0
    );

    if (written) {
        src->written += written;
        if (src->written == src->to_write) {
            unix_socket_close_and_free(src);
        }
    }
}

int unix_socket_server(int *dest, short port)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;

    assert(dest);

    *dest = socket(AF_INET, SOCK_STREAM, 0);
    if (*dest == -1) goto abort;
    if (!unix_socket_set_non_block(*dest)) goto abort;
    if (!unix_socket_reusable(*dest)) goto abort;

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);

    address_p = (struct sockaddr *) &address;

    if (bind(*dest, address_p, sizeof(address)) == -1) goto abort;
    if (listen(*dest, MAX_CONNECTIONS) == -1) goto abort;

    return 1;

abort:
    close(*dest);
    return 0;
}

int unix_socket_listen(int fd)
{
    static struct epoll_event events[MAX_CONNECTIONS] = { 0 };
    static struct unix_socket clients[MAX_CONNECTIONS] = { 0 };
    static char dummy_response[] = 
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "\r\n"
        "Yep, this seems to be working.";

    int epoll_fd = 0;
    struct epoll_event event = { 0 };
    int ev_count = 0;

    struct unix_socket *client = 0;
    ssize_t written = 0;
    ssize_t read = 0;

    epoll_fd = epoll_create1(0);
    if (epoll_fd == -1) goto abort;

    event.events = EPOLLIN | EPOLLET;
    event.data.fd = fd;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, fd, &event) == -1) goto abort;

    while (1) {
        ev_count = epoll_wait(epoll_fd, events, MAX_CONNECTIONS, -1);
        if (ev_count == -1) goto abort;
        for (int i = 0; i < ev_count; i += 1) {
            if (fd == events[i].data.fd) {
                printf("new connection found.\n");
                unix_get_free_socket(&client, clients, MAX_CONNECTIONS);
                if (!unix_socket_accept(client, fd, epoll_fd)) {
                    printf("unable to accept new connection.\n");
                }
                continue;
            }

            client = (struct unix_socket *) events[i].data.ptr;

            if ((events[i].events & EPOLLOUT) == EPOLLOUT) {
                unix_socket_flush_and_close(client);
            }
            if ((events[i].events & EPOLLIN) != EPOLLIN) {
                continue;
            }

            read = recv(client->fd, client->read, sizeof(client->read), 0);
            switch (read) {
            case -1: // error
                printf("error while reading, closing the connection.\n");
                printf("%s.\n", strerror(errno));
                unix_socket_close_and_free(client);
                break;
            case 0: // closed connection
                printf("connection closed as requested by client.\n");
                unix_socket_close_and_free(client);
                break;
            default: // successfully read
                client->received = read;
                printf("new request received.\n");
                printf("%.*s\n", (int) client->received, client->read);
                client->written = 0;
                client->to_write = sizeof(dummy_response) - 1;
                memcpy(client->write, dummy_response, client->to_write);
                unix_socket_flush_and_close(client);
                break;
            }
        }
    }

abort:
    close(epoll_fd);
    close(fd);
    return 0;
}
```