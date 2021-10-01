---
layout:     post
title:      "Refactoring, from ReactJS to Elm"
date:       2020-10-25 17:34:55 -0300
summary:    "I have always wanted to work with Elm. Here are some of my thoughts"
---

I have always wanted to work/try [Elm](https://elm-lang.org/). If you haven't  
heard of it, Elm is a functional programming language for frontend. The really 
cool thing about it, **no runtime exceptions**, meaning, if it compiles, it works and 
the only thing you could find are logic errors.

## From ReactJS to Elm

I have been coding in Javascript for quite some time now, and to be honest I'm 
quite tired of it. The whole ecosystem seems to be a circus: frontend framework 
being more and more over engineered (hello Angular); the same happening to 
libraries; and the language itself is broken, too much flexibility to the point 
were it makes no sense and it's quite easy to shoot yourself in the foot.

So, I [have an small application](https://github.com/Ruk33/trackear) that I 
have been wanted to refactor for quite some time, specially the frontend were 
I originally started with [ReactJS](https://reactjs.org/). It's not a single 
page application, it just a few components written on it so the refactor should 
be quite easy, right?

## Elm, it will poke you until you get it right

The cool thing about Elm is that it will yell at you until you get it right, meaning, 
the compiler wont be happy until you handle all scenarios correctly (and not just 
the happy path as we are used to). At the very beginning it's a bit annoying, you 
just want to save it and watch it running right?, well that's not the case with Elm, 
but, you can be sure it will run properly when it does, at least, you will only 
find logic errors. It may sound like a small thing but trust me, it's not, it gives 
you a real sense of safety knowing you wont run into `undefined is not a function` or 
to all crazy stuff we are used to in Javascript.

The same happens with APIs. Before consuming an API, you have to define what's 
the response you intend to get. If the backend/service doesn't send you back exactly 
what you defined, it will handle the request as failure.

## Libraries

The Elm language is being developed at a slow phase, I mean it's been 
more than a year since the last version and to be honest I'm ok with it, the 
only thing that concerns me is that, on every major version, the community has to
upgrade the libraries, otherwise you won't be able to use it.

The other thing is that, in Javascript and specially ReactJS, we are used to 
get libraries for every single stuff we look for. You want a ReactJS component 
for X? you got it, actually, you may find three version of the same thing. In Elm, 
this may not be the case. If there is a library in Javascript not ported to Elm, 
you can still use it using [ports](https://guide.elm-lang.org/interop/ports.html).

One of the components I've refactor is a calendar/date-picker. Luckily there was 
a [pretty good library/component for it](https://package.elm-lang.org/packages/mercurymedia/elm-datetime-picker/latest/). 
The only thing I had to do was update the styles and fight a bit with how Elm 
deals with dates.

## There isn't much to it

I just loved the experience and the results. Build times don't take long; 
[assets size are great](https://elm-lang.org/news/small-assets-without-the-headache); 
no runtime exceptions; the thing just worked and the development experience was 
quite nice, specially how [the compiler guides you to were problems are](https://elm-lang.org/news/compilers-as-assistants).

If you want to [try it out without fully committing to it](https://elm-lang.org/news/how-to-use-elm-at-work), 
you can do so. It's just a matter of creating a ReactJS component that internally, 
it will be an Elm component. Pretty cool stuff to just get a taste of it without 
having to make big changes.

Here are a few links you may find useful:

- [Official documentation](https://elm-lang.org/docs)
- [Online introduction](https://elmprogramming.com/)
- [Try Elm online](https://ellie-app.com/new)
- [Packages](https://package.elm-lang.org/)
- [Integrate Elm with Webpacker (Rails)](https://github.com/rails/webpacker/blob/master/docs/integrations.md#elm)
