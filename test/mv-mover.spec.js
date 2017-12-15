'use strict';

const mockFs        = require('mock-fs');
const FilenameGen   = require('natural-filename-generator');
const path          = require('path');
const fs            = require('fs');
const globby        = require('globby');

const expect        = require('chai').expect;
const sinon         = require('sinon');

const mover         = require('../src/mv-mover');
const parser        = require('../src/mv-parser');
const TEST_PATH     = path.join('test', 'test-data');

describe('mv-mover', function () {
    describe('commit()', function () {
        it('should rename *.txt files to *.doc on file system, and return [...].length = 2', function () {
            const srcPattern  = path.join(TEST_PATH, '*.txt');
            const dstPattern  = path.join(TEST_PATH, '*.doc');
            const filesList   = this.myParser.resolve(srcPattern);
            const newFilesList = filesList.map(function (name) {
                return name.replace(/\.txt$/, '.doc');
            });

            const returned = this.myMover.commit(filesList, newFilesList);
            // Cross-verification with globby, parser.resolve and fs.existsSync
            expect(globby.sync(srcPattern)).to.be.empty;
            expect(this.myParser.resolve(srcPattern)).to.be.empty;
            expect(globby.sync(dstPattern)).to.have.members(newFilesList);
            expect(this.myParser.resolve(dstPattern)).to.have.members(newFilesList);
            expect(this.myParser.resolve(dstPattern).length).to.eql(2);
            newFilesList.forEach(function (name) {
                expect(fs.existsSync(name)).to.be.true;
            });
            filesList.forEach(function (name) {
                expect(fs.existsSync(name)).to.be.false;
            });
            expect(returned.length).to.eql(2);
            expect(returned).to.have.members([0, 1]);
        });

        it('should invoke the callback if one is provided', function () {
            let filesList  = this.myParser.resolve(path.join(TEST_PATH, '*.JS'));
            filesList.push('non-existing.file');
            filesList.push(123);
            filesList = filesList.concat(this.myParser.resolve(path.join(TEST_PATH, '*.jpeg')));
            filesList = filesList.concat(this.myParser.resolve(path.join(TEST_PATH, '*.TXT')));
            expect(filesList.length).to.eql(8);
            let newFilesList = [path.join(TEST_PATH, '1.jav'),
                                path.join(TEST_PATH, '2.JAV'),
                                'existing.document',
                                'file.123',
                                path.join(TEST_PATH),
                                789,
                                'success.new'];

            this.myCallback = function (err, old, nyou, idx) {
                if (err) {
                    console.log(`From callback: Rename #${idx} ${err}`);
                }
                else {
                    console.log(`From callback: Rename #${idx} ${old} to ${nyou}`);
                }
            };

            sinon.spy(this, 'myCallback');

            const returned = this.myMover.commit(filesList, newFilesList, null, this.myCallback);
            // Renames success: [0, 1, 6]
            expect(returned.length).to.eql(3);
            expect(returned).to.have.members([0, 1, 6]);
            expect(this.myCallback.callCount).to.eql(8);
            // Renames failed: [2, 3, 4, 5, 7]
            this.myCallback.args.forEach(function (arg, idx) {
                switch (idx) {
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 7:
                        // For rename failures #2, 3, 4, 5 and 7, callback should be called with Error as first argument
                        expect(arg[0]).to.be.instanceof(Error);
                        break;
                    default:
                        // For rename success cases...
                        expect(arg[0]).to.be.null;
                }
            });

            this.myCallback.restore();
        });

        it('should handle gracefully non-function passed as callback', function () {
            let filesList    = this.myParser.resolve(path.join(TEST_PATH, '*.up^'));
            let newFilesList = [];

            expect(filesList.length).to.eql(2);
            for (let i = filesList.length - 1; i >= 0; i -= 1) {
                newFilesList.unshift(`${i}.up`);
            }

            // A Number as the callback
            let returned = this.myMover.commit(filesList, newFilesList, null, 123);
            expect(returned).to.have.members([0, 1]);

            filesList = this.myParser.resolve(path.join(TEST_PATH, '*.tm$'));
            expect(filesList.length).to.eql(2);
            newFilesList.length = 0;
            for (let i = filesList.length - 1; i >= 0; i -= 1) {
                newFilesList.unshift(`${i}.tm`);
            }

            // A String as the callback
            returned = this.myMover.commit(filesList, newFilesList, null, '123');
            expect(returned).to.have.members([0, 1]);

            filesList = this.myParser.resolve(path.join(TEST_PATH, '*.z..'));
            expect(filesList.length).to.eql(2);
            newFilesList.length = 0;
            for (let i = filesList.length - 1; i >= 0; i -= 1) {
                newFilesList.unshift(`${i}.z`);
            }

            // An array as the callback
            returned = this.myMover.commit(filesList, newFilesList, null, [123]);
            expect(returned).to.have.members([0, 1]);
        });


        it('should return an [] of indexes of names for which rename succeeded', function () {
            let filesList  = this.myParser.resolve(path.join(TEST_PATH, '*.js'));
            filesList.push('non-existing.file');
            filesList.push(123);
            filesList = filesList.concat(this.myParser.resolve(path.join(TEST_PATH, '*.JPEG')));
            filesList = filesList.concat(this.myParser.resolve(path.join(TEST_PATH, '*.TXT')));
            expect(filesList.length).to.eql(8);
            let newFilesList = [path.join(TEST_PATH, '1.jav'),
                                path.join(TEST_PATH, '2.JAV'),
                                'existing.document',
                                'file.123',
                                path.join(TEST_PATH),
                                789,
                                'success.new'];

            const returned = this.myMover.commit(filesList, newFilesList);
            // Renames:
            // [0] success
            // [1] success
            // [2] failed because original file does not exist
            // [3] failed because original file name is not a string (e.g. number 123)
            // [4] failed because new filename is a path without filename,
            // [5] failed because new file name is not a string (e.g. number 789)
            // [6] success
            // [7] failed because no corresponding new name in array
            expect(returned).to.have.members([0, 1, 6]);
            expect(returned.length).to.eql(3);
        });

        it('should throw a TypeError if invalid argument type passed', function () {
            sinon.spy(this.myMover, 'commit');

            try {
                this.myMover.commit(123, ['somefile.name']);
            }
            catch (e) {
                expect(e).to.be.instanceof(TypeError)
                .and.have.property('message', 'Expects arrays of old and new names.');
            }

            try {
                this.myMover.commit('oldfilename.txt', ['somefile.name']);
            }
            catch (e) {
                expect(e).to.be.instanceof(TypeError)
                .and.have.property('message', 'Expects arrays of old and new names.');
            }

            try {
                this.myMover.commit(['afile.name'], 'another.name');
            }
            catch (e) {
                expect(e).to.be.instanceof(TypeError)
                .and.have.property('message', 'Expects arrays of old and new names.');
            }

            try {
                this.myMover.commit(['afile.name']);
            }
            catch (e) {
                expect(e).to.be.instanceof(TypeError)
                .and.have.property('message', 'Expects arrays of old and new names.');
            }

            expect(this.myMover.commit.alwaysThrew('TypeError')).to.be.true;

            this.myMover.commit.restore();
        });

        /* ----------------------------------------------------- */
        /* ------------ before() and after() section ----------- */
        /* ----------------------------------------------------- */
        before(function () {
            this.myMover    = mover.create();
            this.myParser   = parser.create();
        });

        beforeEach(function () {
            const g         = new FilenameGen();
            const extensions = ['txt', 'TXT', 'jpeg', 'JPEG', 'js', 'JS'];
            let folderContent = {};

            // Build a Map tracking all files in the mock filesystem (created w/ mock-fs).
            // Key is the file extension and value is an array of the filenames with that extension
            // Also builds the object "folderContent" for mock-fs
            for (let i = extensions.length - 1; i >= 0; i -= 1) {
                const name1 = g.generate(extensions[i]);
                const name2 = g.generate(extensions[i]);
                Object.defineProperty(folderContent, name1, {
                    enumerable: true,
                    value: 'created by mock-fs'
                });
                Object.defineProperty(folderContent, name2, {
                    enumerable: true,
                    value: 'created by mock-fs'
                });
            }

            // Add peculiar filenames
            const specialNames = [ '^onecaret.up^', '^^onecaret.up^', '^twocarets.hi^^', '^^twocarets.hi^^',
                '$onedollar.tm$', '$$onedollar.tm$', '$twodollars.js$$', '$$twodollars.js$$',
                'dotnames1.a.b', 'dotnames2.a.b', 'dotdotnames1.z..', 'dotdotnames2.z..'];
            specialNames.forEach(function (name) {
                Object.defineProperty(folderContent, name, {
                    enumerable: true,
                    value: 'created by mock-fs'
                });
            });

            // creates mock test folder and files
            mockFs({
                'test/test-data': folderContent
            });
        });

        afterEach(function () {
            mockFs.restore();
        });
    });
});
