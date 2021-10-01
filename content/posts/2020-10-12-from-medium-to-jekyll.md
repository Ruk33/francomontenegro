---
layout:     post
title:      "From Medium to Jekyll"
date:       2020-10-12 22:56:51 -0300
summary:    "Medium is getting worse and worse. It's time to try a new solution."
---

I recently began writing articles, posts, whatever you wanna call it. 
Nothing serious, nothing fancy, just you know, casual. So, time to set up
a blogging platform or search for services right?

## Platform blogging
Searching for blogging platforms, it seems like the "clear winner" is Medium.
The thing about Medium is that, even though it works pretty well, it's not 
made to publish code. Yes, I know you can create Gists and insert them but, 
this doesn't scale and it becomes a real pain in the ass quite soon.

## Installing a blog
Now the other side of the coin would be to install a blogging platform such 
as Wordpress. Thing is, I really don't wanna deal with it and to be honest, I 
have never liked Wordpress.

So what are the alternatives? I don't know how I recalled it but, I remember 
Jekyll and also remembered that it works pretty well with Github Pages. I have 
never used Jekyll so why not give it a try.

## Perfect for the job
Man, it's works just amazing, nothing fancy to install, no crazy set up/configuration,
it just works pretty well with minimum effort. Not only that, it plays quite 
nice with Github Pages so I think we have a winner.

## A few notes though
If you plan to use it, you may want to search for themes. I have used [Jekyll Themes](https://jekyll-themes.com/free/). They have a pretty nice collection of themes, and plus, they got a 
"free themes" filter which is a huge win for me :P.

Besides that, when using Jekyll on Github Pages, make sure you set up the 
`remote_theme` option on `_config.yml`, otherwise the styles will be messed up.
In my case, I'm using [no style please](https://github.com/riggraz/no-style-please) 
with the option set as `remote_theme: riggraz/no-style-please`.

## Custom sass/css
To add custom styling, you need to check the theme you are using in order to 
know which file you need to overwrite. In my case, it's `_includes/head.html`:

{% raw %}
```html
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <title>
        ...
    </title>

    ...

    <link rel="shortcut icon" type="image/x-icon" href="/{{ site.favicon }}" />
    <link rel="stylesheet" href="{{ site.url }}/assets/css/main.css" />
    <link rel="stylesheet" href="{{ site.url }}/assets/css/styles.css" />
</head>
```
{% endraw %}

With that, create a new file on `assets/css/styles.scss` with the following:

```css
---
---
@import "main";

```

After that, create the final file at `_sass/main.scss`. This is where all your 
styling will take place.

## Script to create new post files
Jekyll stores all the posts under `_post`, with the format `yyyy-mm-dd-title.md` 
and I do not want to type that out manually every time I want to write a new
article, so, here is a pretty simple script I found on the internet:

```bash
#!/bin/bash
# About: Bash script to create new Jekyll posts
# Author: @AamnahAkram
# URL: https://gist.github.com/aamnah/f89fca7906f66f6f6a12 
# Description: This is a very basic version of the script

# VARIABLES
######################################################

# Get current working directory

# Define the post directory (where to create the file)
JEKYLL_POSTS_DIR='_posts'

# Post title
TITLE=$1

# Replace spaces in title with underscores
TITLE_STRIPPED=${TITLE// /-}
TITLE_LOWERCASE=${TITLE_STRIPPED,,}

# Date
DATE=`date +%Y-%m-%d`
DATE_TIME=`date "+%Y-%m-%d %H:%M:%S %z"`

# Post Type (markdown, md, textile)
TYPE='.md'

# File name structure
FILENAME=${DATE}-${TITLE_LOWERCASE}${TYPE}


# COMMANDS
#######################################################

# go to _posts directory
cd ${JEKYLL_POSTS_DIR}

# make a new post file
touch ${FILENAME}

# add YAML front matter
echo -e "---
layout: post
title:  \"${TITLE}\"
date:   ${DATE_TIME}
---
" >> ${FILENAME}
```

You can use it as `sh scripts/new_post.sh "From Medium to Jekyll"` and will 
generate the file accordingly. Pretty cool!