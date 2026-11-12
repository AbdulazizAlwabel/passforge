# Phone sweep

Looks at every page the way a phone shows it and lists anything that is cut off, too small to tap,
or would make iPhone Safari zoom. Not part of `run.sh`: it is a tool for a full pass before a release.

Start the test server (`node tests/harness.js`), then:

```sh
node tests/sweep/sweep.js 375,390,430 en,ar     # every page as it loads
node tests/sweep/states.js 375,390,430 en,ar    # every tool in use: fields filled with awkward text, buttons pressed
```

Each prints one line per distinct finding and a count; zero findings is the goal.

- `EDGE`: an element crosses the left or right edge of the screen
- `CUT`: a label is shortened with an ellipsis
- `SMALL`: a tap target under 24 px (WCAG 2.2, 2.5.8)
- `ZOOM`: a field with text under 16 px (iPhone Safari zooms the page on focus)
- `POP`: an open menu or dialog leaves the screen
- `ERROR`: a script error
