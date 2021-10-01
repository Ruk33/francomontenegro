---
layout:     post
title:      "End to end test with Cypress.io"
date:       2020-10-25 18:25:30 -0300
summary:    "Want to write quick and useful end to end tests? Maybe cypress.io is for you"
---

Testing is one of those things we know we have to do but... let's be honest, 
it's not interesting and quite tedious to do.

And what about end to end testing? you know, making sure the flows of your 
application work as intended and they don't explode. You can automate these tests 
with Selenium which appears to be the standard in the community and also a 
pain in the ass. Or, the alternative, you can do it manually, like a QA guy.

Now, the thing about it is that, I'm a lazy person, too lazy to use the garbage 
of Selenium, and too lazy to manually go and test each flow, so what are 
the alternatives?

## Cypress.io, thank the good lord

When I read about [Cypress.io](https://www.cypress.io/), I was immediately hooked. 
Easy to use, good results, good iteration, simple API. 
[Have you looked at the demo video](https://vimeo.com/237527670)?, it's just amazing.

So I tested it out, I read about it, set a few thing up and I was ready to go.

## Testing an entire flow in just a few minutes

My go to test are login flows and let me tell you, testing the flow with 
Cypress.io not only was fast and easy, it was a real **joy**. You heard me right,
**it was a joy to test the login flow**. In just a few minutes, I was able to 
test invalid account, valid account, invalid submission, and all the good stuf 
your are used to.

## Iteration flow, soo good

When you write your tests, you can have the browser open, listening for changes. 
Every change you make, it will re-run the test, letting you know if it passed or not, 
and this is huge in terms of productivity. And when I say it will re-run the tests,
I don't mean it will slowly run the tests, closing the browser, opening the browser, 
loading for 5 minutes, and then run, when I mean it will re-run the tests, I mean 
in seconds, almost instantly.

## Taking it to the next level

Ok, login flow, not a big deal, what about the entire application? Well, let me 
tell you, I did wrote end to end tests for one of my applications and it took me 
three days. Granted, it's not a huge application, it has a couple of flows, and 
some are more complex than others. In total, I wrote 38 cases. This is just one 
of the flows I've tested:

<iframe width="640" height="480" src="{{ site.url }}/assets/video/cypress-testing-flow-demo.mp4" frameborder="0"> </iframe>

And yes, this was recorded using Cypress.io.

## Using it with Rails

If you are looking to integrate Cypress.io with Rails, you can do so with 
[Cypress on Rails](https://github.com/shakacode/cypress-on-rails), a gem that 
does all the hard work for you.