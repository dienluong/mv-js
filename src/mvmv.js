'use strict';

const fs            = require('fs');
const path          = require('path').posix;
const readlineSync  = require('readline-sync');
const commandLine   = require('commander');
const Controller    = require('./mv-controller');
const Mover         = require('./mv-mover').create();


/**
 * Wrapper for Mover, supporting printout of error onto the console.
 * @type {Object}
 */
const defaultMover = {
    commit: function commit(src, dst) {
        return Mover.commit(src, dst, null, (err) => {
            if (err) {
                printWithMode(err.message);
            }
        });
    }
};

/**
 * Wrapper for Mover, supporting confirmation prompt in interactive mode.
 * @type {Object}
 */
const interactiveMover = {
    commit: function commit(src, dst) {
        let successList = [];

        src.forEach(function confirmAndCommit(oldName, idx) {
            let newName = dst[idx];
            const answerBool = readlineSync.keyInYN(`Sure to move \x1b[37;1m${oldName}\x1b[0m to \x1b[37;1m${newName}\x1b[0m ? `);
            if (answerBool) {
                let resultArr = Mover.commit([oldName], [newName], null, (err) => {
                    if (err) {
                        printWithMode(`${err.message}`);
                    }
                });

                if (resultArr.length) {
                    successList.push(idx);
                }
            }
        });

        return successList;
    }
};

/**
 * Simulates a Mover -- commit() does not change the file system.
 * @type {Object}
 */
const simulateMover = {
    commit: function commit(srcNames, dstNames) {
        let successList = [];
        let newNamesList = [];

        srcNames.forEach(function simulateCommit(src, idx) {
            // Remove the trailing '/', if any.
            let dst = dstNames[idx].endsWith('/') ? dstNames[idx].slice(0, -1) : dstNames[idx];
            if (!fs.existsSync(path.dirname(dst))) {
                // Cannot move if destination path does not exist
                printWithMode(`No such file or directory '${dst}'`);
            }
            else {
                if (!fs.existsSync(dst) && !newNamesList.includes(dst)) {
                    printWithMode(`Moved \x1b[37;1m${src}\x1b[0m to \x1b[37;1m${dst}\x1b[0m`);
                    newNamesList.push(dst);
                    successList.push(idx);
                }
                else {
                    printWithMode(`Skipping '${src}': '${dst}' already exists.`);
                }
            }
        });

        return successList;
    }
};

/**
 * Wrapper for Mover, producing additional printouts onto the console; used for verbose mode.
 * @type {Object}
 */
const verboseMover = {
    commit: function commit(src, dst) {
        let successList = [];

        src.forEach(function verboseCommit(srcName, idx) {
            let resultArr = Mover.commit([srcName], [dst[idx]], null, (err, oldName, newName) => {
                if (err) {
                    printWithMode(`${err.message}`);
                }
                else {
                    printWithMode(`Moved \x1b[37;1m${oldName}\x1b[0m to \x1b[37;1m${newName}\x1b[0m`);
                }
            });

            if (resultArr.length) {
                successList.push(idx);
            }
        });

        return successList;
    }
};

function _printWithPrefix(prefix, message) {
    console.log(prefix + message);
}

let printWithMode;


/**
 * The main function that parses the command line, prints the usage help and the move operation's result.
 * Uses controller object to perform the actual file moving (or renaming) operation.
 */
function run () {
    let myMover = defaultMover;
    let result;

    commandLine
    .version('0.9.7')
    .name('mvmv')
    .description('mvmv command moves (or renames) files specified by <source> to destination names specified by <target>.\n' +
        '  mvmv supports * and ? globbing wildcards for specifying file names pattern.\n' +
        '  If wildcards are used, <source> and <target> must be wrapped in quotes.\n' +
        '  Multiple consecutive * wildcards in <source> are treated as one single * wildcard.\n' +
        '  The file will not be moved if a file with the same name already exists at the target location.')
    .option('-i, --interactive', 'Prompts for confirmation before each move operation.')
    .option('-s, --simulate', 'Dry-runs the move operations without affecting the file system.')
    .option('-v, --verbose', 'Prints additional operation details.')
    .arguments('<source> <target>')
    .parse(process.argv);

    if (commandLine.args.length !== 2) {
        commandLine.outputHelp();
        return;
    }

    const srcGlob = commandLine.args[0];
    const dstGlob = commandLine.args[1];
    printWithMode = _printWithPrefix.bind(null, '');

    if (commandLine.verbose) {
        myMover = verboseMover;
        printWithMode(`\x1b[36mSource:\x1b[0m ${srcGlob}  \x1b[36mDestination\x1b[0m: ${dstGlob}`);
    }
    else if (commandLine.interactive) {
        myMover = interactiveMover;
    }
    else if (commandLine.simulate) {
        myMover = simulateMover;
        printWithMode = _printWithPrefix.bind(null, '[Simulate] ');
        printWithMode(`\x1b[36mSource:\x1b[0m ${srcGlob}  \x1b[36mDestination\x1b[0m: ${dstGlob}`);
    }

    // Use controller object to perform the move operation
    const myController = Controller.create(null, null, myMover);
    try {
        result = myController.exec(srcGlob, dstGlob);
    }
    catch (e) {
        console.log(`Error: ${e.message}`);
        return;
    }

    if (result === null) {
        printWithMode(`Target file not found.`);
    }
    else if (Number.isFinite(result)) {
        printWithMode(`\x1b[36mMoved ${result} file(s)\x1b[0m`);
    }
}

module.exports.run = run;
