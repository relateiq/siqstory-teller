#SiqStory Teller

This module is a small angular app capable of replaying the SiqStory's captured, by [SiqStory Journalist](http://github.com/relateiq/siqstory-journalist "SiqStory Journalist"). Essentially, a less good version of FullStory that I built for fun. It currently fetches whichever story was created last from the siqstory-collector, which is a public lambda instance that the journalist talks to. It would be simple enough to point this thing at any endpoint that returns siqstories if you don't want to use that database (which seems likely).
