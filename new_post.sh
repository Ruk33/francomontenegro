#!/bin/bash

# Generates a new file in posts/YYYY-MM-DD-name.md
# Example: bash new_post.sh my-new-post
hugo new posts/$(date +%F)-$@.md