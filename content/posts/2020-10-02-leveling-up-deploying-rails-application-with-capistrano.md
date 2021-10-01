---
layout:     post
title:      "Leveling up, deploying Rails application with Capistrano"
date:       2020-10-02 20:53:35 -0300
summary:    "First time using Capistrano. Here are some of my notes."
---

Last time we [deployed a rails application using plain good ol’ scripts](https://ruk33.github.io/deploy-rails-application-in-digital-ocean-nginx-and-https). 
Today, we will be deploying it using a more easy, and if you will, a more 
standard approach.

## Enter, Capistrano

So what the hell is [Capistrano](https://capistranorb.com/)? Well put it 
simply, it's just a tool written in Ruby to handle scripts that need to be 
automated in a more easy and readable way. It's a simple way of executing 
ssh scripts.

## Requirements

First of all, [you will need a server](https://m.do.co/c/66d286f34510), and 
the following software installed on it:

- [RVM](https://rvm.io/)
- [NVM](https://github.com/nvm-sh/nvm)
- [Nginx](https://www.nginx.com/)
- [Bundler](https://bundler.io/)
- [Yarn](https://yarnpkg.com/)

If you are using Debian/Ubuntu, you are lucky. Here is a script to install 
everything:

```bash
# Debian/Ubuntu script
# Install nginx
# Install ruby
# Install node & yarn

# Update everything
sudo apt update && sudo apt upgrade

# Install nginx
sudo apt install nginx -y

# Install RVM
sudo apt-get install -y software-properties-common
sudo apt-add-repository -y ppa:rael-gc/rvm
sudo apt-get update -y
sudo apt-get install -y rvm postgresql-client libpq5 libpq-dev
source /etc/profile.d/rvm.sh

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.36.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install ruby (you way need another version)
rvm install ruby-2.6.6

# Install bundler
gem install bundler

# Install node (you may need another version)
nvm install node

# Install yarn
npm i -g yarn
```

## Capifying your project

Now that we got all our server's dependencies installed, let's add Capistrano 
to the project. Add the following to your Gemfile:

```ruby
group :development do
  gem "capistrano", "~> 3.10", require: false
  gem "capistrano-rails", "~> 1.6", require: false
  gem 'capistrano-rvm', require: false
  gem 'capistrano-nvm', require: false
  gem 'capistrano-bundler', '~> 2.0', require: false
  gem 'capistrano3-puma', require: false
end
```

Run `bundle install` to download all the dependencies. Good, now let's run 
`bundle exec cap install`. This will create a few files that Capistrano will 
use on each deploy.

Go ahead and open up the Capfile. Make sure the following lines are included:

```ruby
require "capistrano/rvm"
require "capistrano/nvm"
require "capistrano/bundler"
require "capistrano/rails/assets"
require "capistrano/rails/migrations"
require "capistrano/puma"
install_plugin Capistrano::Puma
install_plugin Capistrano::Puma::Nginx
```

Good, save it, and you are done with it. Open up `config/deploy.rb`. And 
update the following:

```ruby
lock "~> 3.14.1"

# Update with your app's info
set :application, "your_application"
set :repo_url, "https://github.com/your/repo.git"

append :linked_files, "config/master.key"
append :linked_dirs, ".bundle"
append :linked_dirs, "log", "tmp/pids", "tmp/cache", "tmp/sockets", "vendor/bundle", ".bundle", "public/system", "public/uploads"

# Make sure it matches with your server
# This should work, but if not, check where did you installed rvm
set :rvm_custom_path, "/usr/share/rvm"
set :rvm_ruby_string, :local

set :nvm_type, :user
# Update to your node version
set :nvm_node, "v14.13.0"
set :nvm_map_bins, %w{node npm yarn}

set :nginx_use_ssl, true
set :nginx_ssl_certificate, "/etc/ssl/certs/#{fetch(:nginx_config_name)}.pem"
set :nginx_ssl_certificate_key, "/etc/ssl/private/#{fetch(:nginx_config_name)}.pem"
```

We are almost there. Go ahead now and edit `config/deploy/production.rb`. Add the following:

```ruby
server "YOUR-SERVER-IP", user: "root", roles: %w{app db web}
set :rails_env, 'production'
```

## SSL Certificate

It's 2020, we need our page to use HTTPS. Luckily it's pretty easy to do so.

We will be using [LetsEncrypt](https://letsencrypt.org/). Again, if you are 
using Debian/Ubuntu, you are in luck:

```bash
sudo snap install --classic certbot
certbot -d *.example.com -d example.com --manual --preferred-challenges dns certonly
```

Make sure to update example.com to use your domain.

After you run the scripts, you just need to create a new TXT entry in your DNS. 
This way you will be able to complete the challenge and the certificate will 
be generated.

Once you get the certificates, [download the generated files to your machine](https://stackoverflow.com/a/9427585). 
Make sure you download the files to `your-project/cert/production/fullchain.pem` 
and `your-project/cert/production/privkey.pem`. You will thank me later.

## The heavy stuff is completed, now copy-paste time

Here are a few useful tasks I have created to make the whole deployment easier. 
Make sure to create them on `lib/capistrano/tasks` and use the `.rake` extension!

```ruby
# Small little task for nvm to work on the server
# https://github.com/koenpunt/capistrano-nvm/issues/25#issuecomment-321570172
namespace :nvm do
  namespace :webpacker do
    task :validate => [:'nvm:map_bins'] do
      on release_roles(fetch(:nvm_roles)) do
        if !test('node', '--version')
          warn "node is not installed"
          exit 1
        end

        if !test('yarn', '--version')
          warn "yarn is not installed"
          exit 1
        end
      end
    end

    task :wrap => [:'nvm:map_bins'] do
      on roles(:web) do
        SSHKit.config.command_map.prefix['rake'].unshift(nvm_prefix)
      end
    end

    task :unwrap do
      on roles(:web) do
        SSHKit.config.command_map.prefix['rake'].delete(nvm_prefix)
      end
    end

    def nvm_prefix
      fetch(
        :nvm_prefix, -> {
          "#{fetch(:tmp_dir)}/#{fetch(:application)}/nvm-exec.sh"
        }
      )
    end

    after 'nvm:validate', 'nvm:webpacker:validate'
    before 'deploy:assets:precompile', 'nvm:webpacker:wrap'
    after 'deploy:assets:precompile', 'nvm:webpacker:unwrap'
  end
end
```

```ruby
# Upload ssl certificates to the server
# based on the stage being deployed
namespace :deploy do
  namespace :check do
    before :linked_files, :upload_certs do
      on roles(:app), in: :sequence, wait: 10 do
        upload! "cert/#{fetch :stage}/fullchain.pem", fetch(:nginx_ssl_certificate)
        upload! "cert/#{fetch :stage}/privkey.pem", fetch(:nginx_ssl_certificate_key)
      end
    end
  end
end
```

```ruby
# Upload config/master.key file to server
namespace :deploy do
  namespace :check do
    before :linked_files, :set_master_key do
      on roles(:app), in: :sequence, wait: 10 do
        unless test("[ -f #{shared_path}/config/master.key ]")
          upload! 'config/master.key', "#{shared_path}/config/master.key"
        end
      end
    end
  end
end
```

```ruby
# Upload nginx conf to server
namespace :deploy do
  namespace :check do
    before :linked_files, :upload_nginx_conf do
      on roles(:app) do
        invoke 'puma:nginx_config'
      end
    end
  end
end
```

These tasks will:

- [Fix an annoying NVM issue](https://github.com/koenpunt/capistrano-nvm/issues/25)
- Upload your SSL certificates
- Upload your master.key
- Upload your nginx configuration (thanks to capistrano3-puma this gets generated automatically!)

On every deploy.

## Deploy!

Now, with a little bit of luck, run `bundle exec cap production deploy` and it 
should work just fine. If not, I have to say, Capistrano does a pretty good 
job in pointing out where the error is and usually it’s quite easy to fix it.

If everything went well, log into your server and restart your nginx service. 
If you are on Debian/Ubuntu use `sudo nginx -t && sudo systemctl reload nginx`.

And that's it! Now you can deploy more easily with Capistrano.
