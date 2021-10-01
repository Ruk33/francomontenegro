---
layout:       post
title:        "Yet a simpler way of deploying... deploying a rails app with dokku"
date:         2020-10-13 15:54:54 -0300
summary:      "Here are some notes I took when migrating a rails app to dokku"
---

There are so many ways of deploying an application, in this short post I would 
like to walk you through deploying using [dokku](http://dokku.viewdocs.io/dokku/), 
a simple and light PaaS tool.

## TL;DR
```bash
# Get a server with dokku installed (learn how to with http://dokku.viewdocs.io/dokku/getting-started/installation/#1-install-dokku)
# Tip: use DigitalOcean dokku image to make set up easier
ssh root@your-server-ip

# Create app and initialize git
dokku apps:create your_app
dokku git:initialize your_app

# Set up any environment variables required
dokku config:set --no-restart your_app RAILS_MASTER_KEY=...

# Enable and set up domain
dokku domains:enable your_app
dokku domains:set your_app your.domain.com

# Install let's encrypt plugin
# to generate a ssl certificate
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git

# Generate ssl certificate
dokku config:set --no-restart your_app DOKKU_LETSENCRYPT_EMAIL=your@email.com
dokku letsencrypt your_app

# Enable ssl auto renew
dokku letsencrypt:cron-job --add

# In your local machine
git remote add dokku dokku@your-server-ip:your_app
git push dokku master
```

## dokku
I'm sure you are familiar with [Heroku](https://www.heroku.com/), and dokku is 
just that, a tool quite similar to Heroku, but open source and free of charge. 
If you don't know Heroku, it's just a platform to make deployments easier, but 
of course, at a heavy price.

## Quick test
Let's deploy a rails application to see how this puppy behaves. First of all, 
we need a server. I'm using [DigitalOcean](https://m.do.co/c/66d286f34510) since 
it's cheap, works well and most importantly, it comes with a pre-installed 
dokku image when setting up the instance. If you wan to install it manually, 
you can follow the instructions on [how to install dokku](http://dokku.viewdocs.io/dokku/getting-started/installation/#1-install-dokku).

After creating the instance, go ahead and ssh into it. Let's make sure dokku is 
installed with `dokku help`.

If dokku is installed, we can begin with the process. Go ahead and create a new 
application with `dokku apps:create your_app`. Great, now, we want to deploy 
using git, on every push we do. In order to do that, we need to run 
`dokku git:initialize your_app`. Now, go to your local machine, cd into your 
project and add a new remote host with `git remote add dokku dokku@ip:your_app`.

## Environment variables
Since we are using rails for this example, we need to set the 
`RAILS_MASTER_KEY`. We can set environment variables with 
`dokku config:set --no-restart your_app KEY=VALUE`. With that, we can set our 
secret key `dokku config:set --no-restart your_app RAILS_MASTER_KEY=...`.

## First dummy deploy
Go ahead and run `git push dokku master`. This should trigger the deployment 
process. After that, we are ready to set up the domain and ssl certificate.

## Domain & SSL
Again, 2020, we need https and boy, up until now, this is the easiest way I 
have found to set the certificate up.

First, we need to set up the domain for our app. Enable domains with 
`dokku domains:enable your_app`, then run `dokku domains:set your_app your.domain.com`

Once we got the domain configured, we can continue with SSL. In order to set up 
the certificate, we will be using a [dokku plugin](https://github.com/dokku/dokku-letsencrypt.git) 
that makes the whole process very easy.

```bash
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
dokku config:set --no-restart your_app DOKKU_LETSENCRYPT_EMAIL=your@email.com
dokku letsencrypt your_app
dokku letsencrypt:cron-job --add
```

## That's it
Done. Your certificate should be set up and it will auto renew. If you go to
`https://your.domain.com` (after setting up the DNS, so your domain points 
to your instance), you should see the app running.

## Remote commands
Probably you want to be able to run some these commands but from your local 
machine (for example to set up environment variables). In order to do that, 
you have to install the [dokku client](http://dokku.viewdocs.io/dokku/deployment/remote-commands/#official-client). 
Once installed, you can cd into your project's folder and use it:

```bash
dokku proxy:report
=====> your_app proxy information
       Proxy enabled:                 true
       Proxy port map:                http:80:5000 https:443:5000
       Proxy type:                    nginx
```

Notice I didn't included the app_name, that's because dokku is smart enough to 
pick that up from the git remote configuration :)