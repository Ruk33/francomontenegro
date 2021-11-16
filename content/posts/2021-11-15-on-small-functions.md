---
title: "On Small Functions"
date: 2021-11-15T16:10:01-03:00
draft: true
---

## Small functions, really that useful?

So, it's a common suggestion to build or even refactor big functions into 
smaller functions just because "the function is too long". But recently, I have 
found this not to be as useful as it may sound.

```c
int can_create_project(struct user *user)
{
    return !user->banned;
}

int is_project_already_created(struct project *project)
{
    int project_exists = 1; // look in the database
    return project_exists;
}

int create_project(struct user *user, struct project *project)
{
    if (can_create_project(user) && !is_project_already_created(project)) {
        // proceed to create project
        return 1;
    }
    return 0;
}
```

One could argue the previous code looks reasonable enough. It's small, easy
to follow, no weird stuff going on. Now, what if some functions weren't
in the same file? Or not even close to each other? Do you feel like it's 
reading a book, and suddenly it asks "go to page 6". You go to page six, read it,
and the same happens again, the book now asks you "go to page 10", so, fair 
enough, you go to page ten and finally, there are no more jumps but now,
on what page were you? What were you looking again that you end up in page ten?

## It's not that easy to follow

Having to jump from function to function is not ideal. It makes it hard to 
understand the code and reasoning. Wouldn't it be better to have it all in one
long function instead?

```c
int create_project(struct user *user, struct project *project)
{
    if (user->banned) {
        return 0;
    }

    // Check if project already exists
    if (1) {
        return 0;
    }

    // proceed to create the project.

    return 1;
}
```

Now, what's the deal with this new code? It's somewhat easier to follow, I
mean, all the code is right there, no need to jump from function to function;
it looks less scary to refactor since we know, nobody else depends on these
internal instructions; and, we have more flexibility to perform only the 
operations that are needed.

Don't take the refactor & flexibility point lightly though. Being able to 
change part of the code and knowing for sure it won't affect or introduce bugs 
in any other section of the software is a huge thing. It's a free pass to 
refactor, clean and optimize as much as you want.

## Only what's needed

[DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) is quite popular, 
it makes sense, and sometimes it helps the code base but, maybe it's a bit 
misused. Have you run into the scenario where, just because you want to reuse 
some functions, you end up performing operations you don't really need? Or 
even worse, have you forced your implementation to work based on what you 
currently have? I sure have found myself in these situations and it always 
was for the worse.

## Dumb code, until you find a pattern

But don't get me wrong, DRY DOES help, you just need to know when to apply it
and when in doubt, simply don't. Wait for the opportunity. Have an actual answer 
when someone asks why have you created a new function (and don't simply reply,
"it's good practice, you know"). Don't create a new function just because.

The best thing I have found is to write simple, plain and dumb code initially.
The priorities are: make it work; make it simple to follow and reasoning. After
that, I only extract functions if part of the functionality is required in
other parts of the code. Only then, I create another function. Otherwise, you 
add complexity unnecessarily. Don't be afraid of replacing a function call with
inline code and a comment.

```c
// (franco.montenegro) Check if the user can create a project.
// NOTE: This very same logic was used in X, maybe it's a
// good opportunity to extract it into another function.
if (user->banned) {
    return 0
}
```

