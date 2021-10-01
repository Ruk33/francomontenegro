---
layout:     post
title:      "Migrating postgres sql database using dokku"
date:       2020-11-16 00:59:16 -0300
summary:    "dokku is a great platform as a service. Let's see how we can use psql with it."
---

## TL;DR

```sh
# Install and link the database
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git
dokku postgres:create <db-name>
dokku postgres:link <db-name> <app-name>

# Get the internal database ip and password
dokku postgres:info <db-name>

# Restore database
PGPASSWORD=<db-password> pg_dump -U <db-user> -h <db-host> -p <db-port> <db-name> | psql -h <internal-db-ip> -U postgres <db-name>
```

## Migrating your database to dokku postgres

If you are not familiar with it, [dokku](http://dokku.viewdocs.io/dokku/) is an amazing tool. Imagine 
heroku, but free and open source, that's what dokku is, can it get better than that? Anyway, I recently 
needed to move my website and database from a managed database to my dokku instance, and to my surprise,
it was quite easy. Let me tell you the steps to make it even easier.

## Installing dependencies in the new instance

We need to install a couple of dependencies in our new instance machine:

```sh
# Install postgres plugin to dokku
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git
sudo apt install postgresql-client
```

## Creating and linking the new database to the dokku application

After we have installed the postgres plugin, we need to create the database 
and link it to our application:

```sh
dokku postgres:create <db-name>
dokku postgres:link <db-name> <app-name>
```

## Migrating the database

We are ready to migrate the database from the old host to the new instance. First, 
let's get all the information from our new database:

```sh
dokku postgres:info <db-name>
```

And now we can migrate the database

```sh
PGPASSWORD=<db-password> pg_dump -U <db-user> -h <db-host> -p <db-port> <db-name> | psql -h <internal-db-ip> -U postgres <db-name>
```

And that's it, we create a backup using `pg_dump` and restore it using `psql`. 
The new database should have all the data loaded.

## Bonus tip, periodic backups to S3

Let's add automatic backups. First, you will need an AWS account, and then,
go to [IAM](https://console.aws.amazon.com/iam/home?#/home). [Create a new user](https://console.aws.amazon.com/iam/home?#/users$new?step=details) with Programmatic access. Add the Administrator 
permissions (this is not a good practice so you may want to look up what permissions you need, 
in this case, we just need to upload files to S3) and finish the process.

Once you get your account, select the account, go to Security Credentials and 
create a new Access key. Copy the credentials and let's use it with dokku:

```sh
# Authenticate yourself
dokku postgres:backup-auth <db-name> <access-key-id> <secret>
```

Now go to S3 and create a [new bucket](https://s3.console.aws.amazon.com/s3/bucket/create?region=sa-east-1).

## Create a manual backup

Just to make sure everything works, let's create a manual backup with:

```sh
dokku postgres:backup <db-name> <s3-bucket-name>
```

That should create and upload a snapshot to your S3 bucket.

## Automatic backups

```sh
dokku postgres:backup-schedule <db-name> "0 3 * * *" <s3-bucket-name>
```

This will create a backup daily at 3AM.

If you need more information about this amazing plugin, [check the documentation](https://github.com/dokku/dokku-postgres).