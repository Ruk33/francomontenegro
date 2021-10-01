---
layout:     post
title:      "Creating a server emulator in C for Lineage 2"
date:       2020-10-13 09:02:54 -0300
summary:    "Nothing like a good hobby project. Even better if it's in C."
---

For those of you who do not know it, [Lineage 2](https://lineage.com) is a 
MMORPG Korean game who was quite successful in the 2004-2006. I was soo 
hocked up with it that I even began researching how to create my own server 
for it using [L2J](https://l2jserver.com/) (an amazing project in Java that emulates a server), 
back then when I was ~14. I believe it was actually the game that brought me into programming.

Nowadays the game is still online but remains a vague shadow of what once was, 
I mean, it got to a point where even the game itself has a built in bot to 
play the game... do I have to say more?

## Building a server emulator in C

So why C? Well, it's one of those languages that I really like but sadly, I 
don't find projects to work with it, until now. Keep in mind I'm very new to 
the language, so if you are an expert with it, you may cringe a bit.

## Setting the goals

The goal was quite simple, when you open up the game, the first thing you see 
is the login screen. My objective was to:

1 - Being able to stablish a connection with the client

2 - Being able to send basic packets

3 - Being able to get and decrypt packets from the client

4 - Send a "password incorrect" every time the user tries to log in

Quite simple, right?

## A two year project

And then I began. Just to put you in context, I didn't even know how to deal 
with dependencies/libraries on C. At the very beginning I began looking for 
package managers, you know, like [NodeJS](https://nodejs.org/en/) 
uses [NPM](https://www.npmjs.com/), but in C, it seems like these tools are not 
a common thing. So ok, I will install those "manually", what about the Lineage 2 
documentation?

## Thank the god lord for the internet and the documentation

Lineage 2 uses a protocol to communicate between client and server, and luckily,
the internet was [full](http://l2jserver.com/) [of](http://fursoffers.narod.ru/Packets.htm) 
[documentation](https://code.google.com/archive/p/l2adenalib/wikis/L2LoginServerProtocol.wiki).
I didn't quite understood the whole picture yet but at least it was something.

So ok, I kinda knew there was a protocol, there was the packets, each packet 
was composed of the size of the packet, the header (telling you what type 
of packet it was) and the content. I also knew that these packets were encrypted 
using [Blowfish](https://en.wikipedia.org/wiki/Blowfish_(cipher)) and also, 
there was a bit of [RSA](https://en.wikipedia.org/wiki/RSA_(cryptosystem)) in the mix, cool!

## Let's go back to the basics, sockets

The [first version I coded was for Windows](https://github.com/Ruk33/l2auth/tree/976070794384964681e5caaaab6bcd1d0ee62a49), and boy, let me tell you it was painful. 
I don't know if it was because I'm a newbie but the documentation was quite painful, compared 
to Linux that is. Nonetheless, I was able to get a socket running and listening for 
connections. Time to test it and... the whole thing hang up. Nice.

This one, I believe, was the hardest part of the whole project because on every 
test/try, the whole thing hang up and I didn't knew what was wrong, nor the 
client told me. So it was just a matter of changing stuff and try again, multiple 
times until I got it, the packet was coming, the client didn't hang up. Now, it
was a matter of decrypting the packet.

## OpenSSL

For this project, I wanted to do the most from scratch, but I know cryptography 
is one of those things where you simply need to use a library or it's quite 
probably you will get it wrong, kinda like dealing with dates.

Looking for cryptography libraries wasn't hard. I knew I needed something that 
supported RSA and Blowfish and [OpenSSL](https://www.openssl.org/) did that and 
much more, plus it seems to be the standard for these type of things, so it was 
quite safe to pick it up. I also looked at [Sodium](https://libsodium.gitbook.io/doc/), 
and I really liked it but sadly, they don't support Blowfish, and with reason, the
algorithm is quite old and deprecated for newer ones.

## Playing around and trying to decrypt packages

Again, similar to the previous issue with the client hanging up, I found cryptography 
quite similar, you try it, you see it doesn't work, and you try again. There is 
nothing telling you "hey, you may wanna look into this".

So I spent quite a bit of time on this one, I review the code multiple times, I 
even scratch it and began all over again but nothing, I wasn't able to decrypt 
the packet. I read the documentation from OpenSSL, I checked the Lineage 2 
documentation and nothing. Everything seemed to be right, and then, I saw it...
[endianness](https://en.wikipedia.org/wiki/Endianness). Oh my f*cking lord, but 
oh well, a new concept to learn because I wasn't even aware this was even a thing.

We are back into the game, I reviewed the documentation and found a mismatch,
Lineage 2 deals with little endian while OpenSSL deals with big endian. Now I 
only needed a way to convert it:

```c
#include <assert.h>

unsigned int decode32le(const void* src)
{
        assert(src);
        const unsigned char* buf = src;
        return (unsigned int) buf[0] | ((unsigned int) buf[1] << 8)
                | ((unsigned int) buf[2] << 16) | ((unsigned int) buf[3] << 24);
}

unsigned int decode32be(const void* src)
{
        assert(src);
        const unsigned char* buf = src;
        return (unsigned int) buf[3] | ((unsigned int) buf[2] << 8)
                | ((unsigned int) buf[1] << 16) | ((unsigned int) buf[0] << 24);
}

void encode32le(void* dst, unsigned int val)
{
        assert(dst);
        unsigned char* buf = dst;
        buf[0] = (unsigned char) val;
        buf[1] = (unsigned char) (val >> 8);
        buf[2] = (unsigned char) (val >> 16);
        buf[3] = (unsigned char) (val >> 24);
}

void encode32be(void* dst, unsigned int val)
{
        assert(dst);
        unsigned char* buf = dst;
        buf[3] = (unsigned char) val;
        buf[2] = (unsigned char) (val >> 8);
        buf[1] = (unsigned char) (val >> 16);
        buf[0] = (unsigned char) (val >> 24);
}
```

Not the prettiest, maybe and quite possibly not the best but functional. Time 
to test it again and... there was it, my login credentials printed on the 
terminal.

Now, I can read from the client, great! What about answering back?

## Answering back, coming up soon

I will leave this section for a second part, but I can tell you, the project 
is so fun and exciting, that not only I was able to answering and sending packets 
back to the client, I went way further into the goals and now, I'm able to log
into the game and play it.

You can find the [source code of this project on GitHub](https://github.com/Ruk33/l2auth).
I have included support for [Docker](https://www.docker.com/) to make the 
installation easier. You are more than welcome to contribute if you would like to.