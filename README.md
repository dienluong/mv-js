[![Build Status](https://travis-ci.org/dienluong/mvmv.svg?branch=master)](https://travis-ci.org/dienluong/mvmv) [![Build status](https://ci.appveyor.com/api/projects/status/a5yh2m947yqt5v42?svg=true)](https://ci.appveyor.com/project/dienluong/mvmv) [![Known Vulnerabilities](https://snyk.io/test/github/dienluong/mvmv/badge.svg?targetFile=package.json)](https://snyk.io/test/github/dienluong/mvmv?targetFile=package.json) [![Coverage Status](https://coveralls.io/repos/github/dienluong/mvmv/badge.svg?branch=master)](https://coveralls.io/github/dienluong/mvmv?branch=master) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Greenkeeper badge](https://badges.greenkeeper.io/dienluong/mvmv.svg)](https://greenkeeper.io/)
 
# mvmv
A [NodeJS](https://nodejs.org) package that performs batch renaming and moving of files, with support for globbing [wildcards](http://tldp.org/LDP/GNU-Linux-Tools-Summary/html/x11655.htm) `*` and `?`.

You can use the package by importing it into your NodeJS scripts or as a command on the terminal.

> ##### Note:
> Go on [github](https://github.com/dienluong/mvmv) for the latest version of this documentation.

## Motivation
The typical implementations of the linux mv command do not support this rather intuitive usage:
```bash
> mv *.txt *.old
```

## Installation
Installation is straightforward, as with most [NPM](https://www.npmjs.com/) packages.

Install `mvmv` globally to use it as a command line tool anywhere on the command console:
```bash
> npm install -g mvmv
```

Install it as a dependency to use it in your code:
```bash
> npm install --save mvmv
```

## In-code Usage
`mvmv.exec(src, dst, cb)` accepts a callback and returns the number of successful files moved (returns NULL if file not found).

The callback is invoked after a move/rename attempt on an **individual** file. The arguments passed to the callback are: `error`, `oldPath`, `newPath`, `index`. `index` is the zero-based position of the file in the batch of files to be processed. 

##### Example
```javascript
const mvmv = require('mvmv').create();

mvmv.exec('*.txt', 'temp/*.old');
```

## Command-line Usage
With package installed globally:
```bash
> mvmv '*.txt' 'temp/*.old'
````

Execute the `mvmv` command without argument to display the usage information:

```
  Usage: mvmv [options] <source> <target>

  mvmv command moves (or renames) files specified by <source> to destination names specified by <target>.
  mvmv supports * and ? globbing wildcards for specifying file names pattern.
  If wildcards are used, <source> and <target> must be wrapped in quotes.
  Multiple consecutive * wildcards in <source> are treated as one single * wildcard.
  The file will not be moved if a file with the same name already exists at the target location.


  Options:

    -V, --version      output the version number
    -i, --interactive  Prompts for confirmation before each move operation.
    -s, --simulate     Dry-runs the move operations without affecting the file system.
    -v, --verbose      Prints additional operation details.
    -h, --help         output usage information
```


>##### Tip!
>You can invoke `mvmv` without prior installing it by using [npx](https://www.npmjs.com/package/npx) (bundled with NPM since v5.2.0):
>```bash
>> npx mvmv '*.txt' 'temp/*.old'
>```

## Caveats
- `mvmv` does not overwrite existing files.
- `mvmv` treats consecutive `*` wildcard in the source glob pattern as a single `*`. (This does not apply to the destination glob pattern.)
- globbing patterns on the command line must be enclosed in quotes to prevent wildcard expansion by the shell. An alternative is to turn shell globbing off. See StackOverflow [thread](https://stackoverflow.com/a/22945024) for more information.


## How It Works
Wildcards in the destination glob pattern correspond to the wildcards of the same type appearing in the source glob pattern, matched by the order in which they appear.

##### Example
```
mvmv '**-*-lines-*?-*?.txt' '*_*-lines-s?e?.txt'
      |  |        |  |       | |        | |
      |  |        |  +-------|-|--------|-+
      |  |        +----------|-|--------+
      |  +-------------------|-+
      +----------------------+
```
(Reminder: consecutive `*` wildcards in the source glob pattern are treated as a single `*`.)

##### Demonstration
![mvmv-demo2](https://user-images.githubusercontent.com/4752832/46907844-fb606a80-cee6-11e8-824b-f58878a92a44.png)
