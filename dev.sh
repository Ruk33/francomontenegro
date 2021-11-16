#!/bin/bash

# Download the templates
git submodule update --init

# Start the server at localhost:1313 (yeah... don't know about that port)
hugo -D serve