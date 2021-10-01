---
layout:     post
title:      "Deploy Rails application in DigitalOcean, Nginx, and HTTPS"
date:       2020-09-27 20:53:35 -0300
summary:    "Simple and to the point. How to deploy a rails app."
---

Straight to the point, you need to deploy a Rails application and you are 
using a VPS solution such as DigitalOcean, Linode, or the likes? Good, do you 
also need to use Nginx instead of `rails -s -p 80`? Perfect, and… https as well 
right? Sounds good, let’s get to it.

## TL;DR

I have created a [simple script](https://gist.github.com/Ruk33/00cde2c4fecf3ff38bfd634a6d54e762) 
to make the whole process easier.

Make sure to update the variables and you can run it from your host machine 
with `cat ./rails-prod-deploy.sh | ssh root@your-server-ip`

This script will:
- Clone your project
- Install rvm
- Install ruby dependencies
- Install nvm
- Install frontend dependencies
- Precompile assets
- Create database and run migrations
- Start the application

---

## Starting the VPS instance

I don’t think I need to explain too much in this instance. If you are using 
[DigitalOcean](https://m.do.co/c/66d286f34510) (that’s my own link, if you 
sign up you get $100 as credit, pretty nice), just create a new droplet and 
select Ubuntu as OS. If your app is small and you don’t expect a lot whole 
of traffic you can just go with the $5 instance.

## Getting into the server

You can use SSH or a password, using SSH is recommended.

Let’s make sure we update the system first. Run `sudo apt update && sudo apt upgrade`

## OPTIONAL — Swap memory

If you choose a small instance (ie $5 droplet) it’s a good idea to set up a 
swap memory so we don’t run into memory issues. Go ahead and run the 
following commands:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo cp /etc/fstab /etc/fstab.bak
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50
```

Huge thanks and credits to [Brian Boucheron's DigitalOcean article](https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-20-04).

## Nginx + HTTPS

Update your domain DNS to point to your instance. We will be setting up 
Nginx but also, we will get our certificate from LetsEncrypt.
To set up your Nginx config, let's use [DigitalOcean tool for Nginx](https://www.digitalocean.com/community/tools/nginx?domains.0.server.domain=your-domain.com&domains.0.server.path=%2Fvar%2Fwww%2Ftrackear&domains.0.server.wwwSubdomain=true&domains.0.php.php=false&domains.0.routing.index=index.html&domains.0.routing.fallbackHtml=true&domains.0.routing.fallbackPhp=false&domains.0.logging.accessLog=true&domains.0.logging.errorLog=true)

You can make the changes you need.

Once you are done, go to the bottom and click on Copy Base64 (you will need 
it later to follow the instructions from Setup).

Install Nginx and Certbot

```bash
sudo snap install -- classic certbot
sudo apt install -y nginx
```

Follow the instructions from Setup. When done, you should have an HTTPS 
ready to be used.

## Setting up the application

Clone/download your project in your VPS.

Install RVM (it lets you install any ruby version quite easily) with:

```bash
sudo apt-get install -y software-properties-common
sudo apt-add-repository -y ppa:rael-gc/rvm
sudo apt-get update -y
sudo apt-get install -y rvm postgresql-client libpq5 libpq-dev
source /etc/profile.d/rvm.sh
```

Go to your project’s folder and install the dependencies:

```bash
cd path/to/project
rvm install
gem install bundler
bundle install
```

Perfect, now let’s install the frontend dependencies. Let’s install NVM 
(same as RVM but for nodejs):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.36.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

Optional, if you are using yarn:

```bash
npm i -g yarn
```

Now we can install the frontend dependencies:

```bash
cd path/to/project
npm i # or yarn
```

**Important, make sure you have your config/master.key in place, otherwise, 
the following steps may fail.**

## Compiling assets

Since we are deploying for production we need to precompile the assets:

```bash
cd path/to/project
NODE_ENV=production RAILS_ENV=production bundle exec rake assets:precompile
```

## Create database and run migrations

Now we can create the database and run the migrations:

```bash
cd path/to/project
RAILS_ENV=production bundle exec rake db:create db:migrate
```

## Almost done!

Ok, we got the assets and the database created, now we need to make a 
small adjustment in the Nginx configuration. Go ahead and open up yours:

```bash
vim /etc/nginx/sites-available/trackear.app.conf
```

Press "i" so you enter in edit mode for vim and, at the top of the file, 
add the following:

```
upstream app {
    server unix:///path/to/project/shared/sockets/puma.sock fail_timeout=0;
}
```

Make sure to update /path/to/project.

Also, pay close attention to the whole file, you will probably need to update 
paths (ie, root to reflect the route where your project is).

Inside of `server { ... }` (the first one, the one containing `listen 443 ...`) 
add the following:

```
try_files $uri/index.html $uri @app;
# index.html fallback
location @app {
    proxy_pass http://app;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_redirect off;
}
```

With that, Nginx should be done. You can save the file and exit from vim 
typing ":wq" (if it doesn’t work, closing the window, and unplugging the PC 
is also an option).

## Run and test!

Alright, this is the moment to be on your knees and pray that nothing breaks 
up. Sounds fun right?

Let’s begin by starting rails:

```bash
cd path/to/project
mkdir -p tmp/sockets
RAILS_ENV=production bundle exec puma -b unix:///path/to/project/shared/sockets/puma.sock
```

Make sure the path you pass in `-b unix://` matches the one you set up in your 
Nginx configuration!

Rails done, and now... this is pray time, restart the Nginx service and pray 
for it to work:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

If it worked, congratulations. But let's be honest, I’m sure there is a small 
error so get back to work. The joy of being a developer/devops/sysadmin.

Hope this small guide helps you!
