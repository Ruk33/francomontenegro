---
layout:     post
title:      "FeathersJs, a quick way of prototyping in NodeJS"
date:       2020-11-16 01:52:49 -0300
summary:    "Need something quick? Maybe FeatherJS may be the answer."
---

So I recently helped a friend of mine with one of his applications. 
The requirements were quite easy, you know the usual:

- Registration
- Login
- Data entry
- Third-party API consumption (just an HTTP call)

Pretty simple right? if it would depend on my I would throw a good ol' Ruby on 
Rails on the mix and pretty much everything is done. Thing was, the tech stack 
was already defined and we couldn't just change it.

The tech stack we had to work with was [NodeJS](https://nodejs.org/en/) and... you may want to get a bucket 
to throw up... [MongoDB](https://www.mongodb.com/) (yes, I don't like no-SQL databases). For the frontend, it 
was [React](https://reactjs.org/). I'm a bit tired of React but that wasn't so bad.

## Hunting for a foundation to work on

My first thought was, "ok we can get something quickly with [ExpressJS](https://expressjs.com/)", 
but man, I wanted something a bit more pre-configured and, with ExpressJS you have to
set up database connections, authentication and a few other things. I mean, this is
not a flaw of ExpressJS, it's in fact by design. It's light and it only has the features 
it needs to get the minimum working.

## Letting the lazy instinct kick in

Or :cough: being smart and choosing the tools based on the work I need to do. Luckily for us,
ExpressJS has a very good [resource collection](https://expressjs.com/en/resources/frameworks.html) 
where you can choose between a few frameworks.

If you open up the previous link, you will see the first result, what does it say?

> Feathers: Build prototypes in minutes and production ready real-time apps in days.

NICE! exactly what we needed, quick, ready to go. What are we waiting for?

## Generating the project

[FeathersJS](https://feathersjs.com/) has a pretty good generator where you can 
set up all the requirements you need for your project:

```sh
npm install @feathersjs/cli -g
feathers generate app
```

It will ask you if you want to use Typescript or Javascript; do you want to use
REST or Sockets, or maybe both?; authentication strategy?; and a few other options that 
in summary makes for a great experience.

## FeathersJS is a bit different from your usual MVC framework

One thing you have to keep in mind is that FeathersJS is a bit different from 
the usual MVC framework. With FeathersJS, you are forced to write endpoints in a 
[RESTful fashion](https://docs.feathersjs.com/help/faq.html#how-do-i-create-custom-methods). 
I don't know how I feel about it but for this project, I think it's ok.

## Authentication, authorization, the juicy part

So how do we deal with authorization and authentication on the app? On the backend, 
we are pretty much set up, the generator will handle everything, but on the 
frontend, we need to work a bit.

## FeathersJs on the frontend as well!

Luckily, FeathersJs has a frontend library that makes consuming services from 
the backend quite easy, including, authentication/authorization.

```sh
npm install @feathersjs/authentication --save
npm install @feathersjs/rest-client --save
npm install axios --save
```

After installing those dependencies, let's set up a few things:

```js
import feathers from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth from '@feathersjs/authentication-client';
import axios from 'axios';

const app = feathers();
const restClient = rest('http://your-backend');

app.configure(restClient.axios(axios));
app.configure(auth({ storageKey: 'auth' }));
```

And that's it. Let's look at some examples.

## Has the user an active session?

The user just logged in but refreshed the page, how do we prevent from
losing the session or even getting it back?

```js
try {
    await app.reAuthenticate()
    // User is already authenticated
} catch (e) {
    // User has no current active session
}
```

## Register new user

For registering a user, we need to create a new entry in the database. We can
do so with:

```js
await app.service('users').create({
    email,
    password
});
```

## Login/logout and getting the current session

```js
await app.authenticate({
    strategy: 'local',
    email,
    password
});

// Getting current session
await app.get('authentication');

await app.logout()
```

## Consuming protected endpoints

Ok, now we need to consume an endpoint that's behind an authorization wall. 
The users have to be logged in otherwise it can't use it, how do we do it?

First of all, let's create a new model, or, how FeathersJs refers to it, service:

```sh
feathers generate service
```

Again, the generator will ask you a few questions about it, one of those being,
does this service requires authentication? Perfect, exactly what we are looking for.

If you look at the generated files, you will notice there is a `<service-name>.hooks.js`. 
Go ahead and open that up:

```js
const { authenticate } = require('@feathersjs/authentication').hooks;

module.exports = {
  before: {
    all: [ authenticate('jwt') ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  ...
};
```

FeathersJs makes use of [hooks](https://docs.feathersjs.com/guides/basics/hooks.html#quick-example) 
to attach some of these behaviors, in this case, we are saying that before performing 
any action on this service, it has to go through the `authenticate` hook.

The `authenticate` hook will make sure only authenticated users can use this service. 
If a guest tries to use it, it will simply return a good ol' `401 Unauthorized`.

## Reviewing original requirements

Ok, so we said we needed authorization, authentication, login, register, and finally, 
a third party API call. We pretty much got everything except for the last one.

Going a bit deeper on the requirement, we need to consume a third-party API when 
saving a new record in the database. We need to store the result of that API call in the 
new entry. And, I don't know about you but this looks like a perfect job for hooks, right?

## Adding behavior with hooks

Writing custom hooks is quite easy, you just need to define a function that takes 
a `context` as a parameter and then return it.

Let's implement our requirement then:

```js
const storeApiResult = async (context) => {
    const service = context.app.service('<service-name>');
    const result = await service.consumeApi();
    context.data.api_result = result;
    return context;
};

module.exports = {
  before: {
    all: [ authenticate('jwt') ],
    find: [],
    get: [],
    create: [ storeApiResult ],
    update: [ storeApiResult ],
    patch: [ storeApiResult ],
    remove: []
  },

  ...
}
```

Every time we create a new entry or update it, we will run `storeApiResult` and 
update its `api_result` value. But wait, where is `service.consumeApi` defined?

This method is defined on `<service-name>.class.js` as such:

```js
const { Service } = require('feathers-mongoose');
const http = require('http');

exports.ServiceName = class ServiceName extends Service {
    consumeApi = () => {
        const options = {
            host: 'www.api.com',
            port: 80,
            method: 'GET'
        };

        const servicePromise = (resolve, _) => {
            const handleRequest = function(request) {
                var str = ''

                request.on('data', function(chunk) {
                    str += chunk;
                });

                request.on('error', function() {
                    resolve(0);
                });

                request.on('end', function() {
                    try {
                        resolve(str);
                    } catch (e) {
                        resolve(0);
                    }
                });
            };

            http.request(options, handleRequest).end();
        };

        return new Promise(servicePromise);
    }
}
```

And that's it, we got all the requirements! Oh wait, we need to add data entry 
as well. No problem!

```js
await app.service('<service-name>').create({
    foo: 'foo',
    bar: 'bar'
});
```

This will create a new entry in the database only if our user is authenticated.