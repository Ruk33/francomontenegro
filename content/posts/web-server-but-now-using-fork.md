---
title: "Web Server but Now Using Fork"
date: 2022-04-22T10:44:01-03:00
---

Yesterday I wrote a post about how to create a web server from scratch using
plain good ol' C. The thing is, I couldn't resist the temptation of re-writting 
the server but this time, using `fork`. I was quite happy with the results,
not only is the code shorter but it seems to work better using a basic
stress test.

## It's fork time

If you are not familiar with it, `fork` allows to create a copy of the process.
Which means, we don't really have to worry about blocking operations, we can
block as much as we want and this, simplifies the code quite a bit.

## Let's start from the beginning

First off, let's write the socket creation function:

```c
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

Nice, no async flag is required. Remember, this time, it doesn't really
matter if we block since each connection will run in it's own process.

Good, let's continue with the listening function:

```c
int unix_socket_listen(int fd)
{
    size_t accepted = 0;

    // prevent zombie process.
    signal(SIGCHLD, SIG_IGN);

    while (1) {
        unix_socket_accept_and_fork(fd);
        accepted += 1;
        printf("accepting nº: %ld.\n", accepted);
    }

abort:
    shutdown(fd, SHUT_RDWR);
    close(fd);
    return 0;
}
```

Well, that was short one. Do pay extra attention to the `signal` call. This
call will prevent zombie processes from leaking (leaking zombie
processes is a no bueno)

## Accepting the connections

Ok, how about accepting connections, let's see how the 
`unix_socket_accept_and_fork` works:

```c
static int unix_socket_accept(struct unix_socket *client, int server_fd)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;
    socklen_t addrlen = 0;

    assert(client);

    address_p = (struct sockaddr *) &address;
    client->fd = accept(server_fd, address_p, &addrlen);

    if (client->fd == -1) {
        printf("unable to accept new client.\n");
        printf("%s.\n", strerror(errno));
        goto abort;
    }

    return 1;

abort:
    close(client->fd);
    return 0;
}

static void unix_socket_accept_and_fork(int fd)
{
    pid_t pid = 0;

    char dummy_response[] = 
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "\r\n"
        "Yep, this seems to be working.";

    struct unix_socket client = { 0 };
    ssize_t read = 0;

    if (!unix_socket_accept(&client, fd)) {
        return;
    }

    pid = fork();

    switch (pid) {
    case -1: // error
        printf("unable to fork. dropping connection.\n");
        printf("%s.\n", strerror(errno));
        shutdown(client.fd, SHUT_RDWR);
        close(client.fd);
        return;
    case 0: // child process
        printf("new client forked.\n");
        // from the forked process (child)
        // we no longer care about the server socket
        // so we can close it.
        close(fd);
        break;
    default: // parent process
        // from the parent, we no longer care about
        // the accepted client, it will be handled
        // by the forked process.
        close(client.fd);
        return;
    }

    printf("connection accepted, waiting for requests.\n");
    read = recv(client.fd, client.read, sizeof(client.read), 0);
    switch (read) {
    case -1: // error
        printf("error while reading, closing the connection.\n");
        printf("%s.\n", strerror(errno));
        goto abort;
    case 0: // closed connection
        printf("connection closed as requested by client.\n");
        goto success;
    default: // successfully read
        client.received = read;
        printf("new request received.\n");
        printf("%.*s\n", (int) client.received, client.read);
        client.written = 0;
        client.to_write = sizeof(dummy_response) - 1;
        memcpy(client.write, dummy_response, client.to_write);
        while (!unix_socket_flush(&client));
        break;
    }

success:
    shutdown(client.fd, SHUT_RDWR);
    close(client.fd);
    exit(EXIT_SUCCESS);
abort:
    shutdown(client.fd, SHUT_RDWR);
    close(client.fd);
    exit(EXIT_FAILURE);
}
```

Alright, this one is a bit chunkier but no so much. If you take a look at it,
the code is pretty simple and straightforward. The only tricky part is 
remembering to close file descriptors that no longer apply (or are useful) to
each process. For example, when the server accepts the new connection, we 
need to close the file descriptor of that connection and let the child
process take care of it. The same applies for the child process, from it, 
we no longer care about the server's file descriptor. Don't forget this step,
otherwise, you will end up with "Too many files descriptors open" problem.

## Pushing responses

Again, being able to block as much as we want simplifies the whole process
quite a bit. Here is the function to push responses:

```c
static int unix_socket_flush(struct unix_socket *src)
{
    ssize_t written = 0;

    assert(src);

    if (!src->to_write) {
        return 0;
    }

    written = send(
        src->fd,
        src->write + src->written,
        src->to_write - src->written,
        0
    );

    if (written) {
        src->written += written;
    }

    return src->written == src->to_write;
}

```

## And that's it!

We can play around with a very basic stress test:

```bash
# stress.sh
#!/bin/bash

#### Default Configuration

CONCURRENCY=10
REQUESTS=10000
ADDRESS="http://localhost:8080/"

show_help() {
cat << EOF
Naive Stress Test with cURL.
Usage: ./stress-test.sh [-a ADDRESS] [-c CONCURRENCY] [-r REQUESTS]
Params:
  -a  address to be tested.
      Defaults to localhost:8080
  -c  conccurency: how many process to spawn
      Defaults to 1
  -r  number of requests per process
      Defaults to 10
  -h  show this help text
Example:
  $ ./stress-test.sh -c 4 -p 100 (400 requests to localhost:8080)
EOF
}


#### CLI

while getopts ":a:c:r:h" opt; do
  case $opt in
    a)
      ADDRESS=$OPTARG
      ;;
    c)
      CONCURRENCY=$OPTARG
      ;;
    r)
      REQUESTS=$OPTARG
      ;;
    h)
      show_help
      exit 0
      ;;
    \?)
      show_help >&2
      echo "Invalid argument: $OPTARG" &2
      exit 1
      ;;
  esac
done

shift $((OPTIND-1))

#### Main

for i in `seq 1 $CONCURRENCY`; do
  curl -s "$ADDRESS?[1-$REQUESTS]" & pidlist="$pidlist $!"
done

# Execute and wait
FAIL=0
for job in $pidlist; do
  echo $job
  wait $job || let "FAIL += 1"
done

# Verify if any failed
if [ "$FAIL" -eq 0 ]; then
  echo "SUCCESS!"
else
  echo "Failed Requests: ($FAIL)"
fi
```

Thanks to https://gist.github.com/cirocosta/de576304f1432fad5b3a for this 
handy stress test script!

Now, compile and execute the server:

```bash
gcc main.c
./a.out
```

Run the stress test:

```bash
time bash stress.sh
```

Sit and relax, see how all of those requests are being handled with no
problem by your server :)

## Full code!

```c
// server.c

#include <assert.h>     // assert
#include <stdlib.h>     // exit
#include <errno.h>      // errno
#include <string.h>     // memcpy, strerror
#include <unistd.h>     // close, fork
#include <signal.h>     // signal, SIGCHLD, SIG_IGN
#include <sys/socket.h> // socket
#include <arpa/inet.h>  // sockaddr_in, INADDR_ANY, htons

#define KB(x) ((x) * 1024)
#define MAX_CONNECTIONS (SOMAXCONN)

typedef unsigned char byte;

struct unix_socket {
    int fd;
    byte read[KB(8)];
    byte write[KB(8)];
    size_t received;
    size_t written;
    size_t to_write;
};

static int unix_socket_reusable(int fd)
{
    int reusable_enable = 0;
    reusable_enable = 1;
    return setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reusable_enable, 4) == 0;
}

static int unix_socket_accept(struct unix_socket *client, int server_fd)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;
    socklen_t addrlen = 0;

    assert(client);

    address_p = (struct sockaddr *) &address;
    client->fd = accept(server_fd, address_p, &addrlen);

    if (client->fd == -1) {
        printf("unable to accept new client.\n");
        printf("%s.\n", strerror(errno));
        goto abort;
    }

    return 1;

abort:
    close(client->fd);
    return 0;
}

static int unix_socket_flush(struct unix_socket *src)
{
    ssize_t written = 0;

    assert(src);

    if (!src->to_write) {
        return 0;
    }

    written = send(
        src->fd,
        src->write + src->written,
        src->to_write - src->written,
        0
    );

    if (written) {
        src->written += written;
    }

    return src->written == src->to_write;
}

static void unix_socket_accept_and_fork(int fd)
{
    pid_t pid = 0;

    char dummy_response[] = 
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "\r\n"
        "Yep, this seems to be working.";

    struct unix_socket client = { 0 };

    ssize_t read = 0;

    if (!unix_socket_accept(&client, fd)) {
        return;
    }

    pid = fork();

    switch (pid) {
    case -1: // error
        printf("unable to fork. dropping connection.\n");
        printf("%s.\n", strerror(errno));
        shutdown(client.fd, SHUT_RDWR);
        close(client.fd);
        return;
    case 0: // child process
        printf("new client forked.\n");
        close(fd);
        break;
    default: // parent process
        close(client.fd);
        return;
    }

    printf("connection accepted, waiting for requests.\n");
    read = recv(client.fd, client.read, sizeof(client.read), 0);
    switch (read) {
    case -1: // error
        printf("error while reading, closing the connection.\n");
        printf("%s.\n", strerror(errno));
        goto abort;
    case 0: // closed connection
        printf("connection closed as requested by client.\n");
        goto success;
    default: // successfully read
        client.received = read;
        printf("new request received.\n");
        printf("%.*s\n", (int) client.received, client.read);
        client.written = 0;
        client.to_write = sizeof(dummy_response) - 1;
        memcpy(client.write, dummy_response, client.to_write);
        while (!unix_socket_flush(&client));
        break;
    }

success:
    shutdown(client.fd, SHUT_RDWR);
    close(client.fd);
    exit(EXIT_SUCCESS);
abort:
    shutdown(client.fd, SHUT_RDWR);
    close(client.fd);
    exit(EXIT_FAILURE);
}

int unix_socket_server(int *dest, short port)
{
    struct sockaddr_in address = { 0 };
    struct sockaddr *address_p = 0;

    assert(dest);

    *dest = socket(AF_INET, SOCK_STREAM, 0);
    if (*dest == -1) goto abort;
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
    size_t accepted = 0;

    // prevent zombie process.
    signal(SIGCHLD, SIG_IGN);

    while (1) {
        unix_socket_accept_and_fork(fd);
        accepted += 1;
        printf("accepting nÂº: %ld.\n", accepted);
    }

abort:
    shutdown(fd, SHUT_RDWR);
    close(fd);
    return 0;
}
```

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