'use strict';

const path          = require('path').posix;
const mockFs        = require('mock-fs');
const FilenameGen   = require('natural-filename-generator');
const TEST_PATH     = path.join('test', 'test-data');

const expect        = require('chai').expect;
const sinon         = require('sinon');
const globby        = require('globby');

const Controller    = require('../src/mv-controller');
const Parser  = require('../src/mv-parser');
const Renamer = require('../src/mv-renamer');
const Mover   = require('../src/mv-mover');

describe('Controller', function () {
    describe('exec()', function () {
        describe('invoked after init() called', function () {
            it('should use parser provided to init()', function () {
                const srcGlob = path.join(TEST_PATH, '*.hi^^');
                const dstGlob = path.join(TEST_PATH, '*.a.b');
                this.myController.init(this.myParser);
                this.myController.exec(srcGlob, dstGlob);
                expect(this.myParser.resolve.called).to.be.true;
            });

            it('should use renamer provided to init()', function () {
                const srcGlob = path.join(TEST_PATH, '*.tm$');
                const dstGlob = path.join(TEST_PATH, '*.js$$');
                this.myController.init(null, this.myRenamer);
                this.myController.exec(srcGlob, dstGlob);
                expect(this.myRenamer.computeName.called).to.be.true;
            });

            it('should use mover provided to init()', function () {
                const srcGlob = path.join(TEST_PATH, '*.z..');
                const dstGlob = path.join(TEST_PATH, '*.tm$');
                this.myController.init(null, null, this.myMover);
                this.myController.exec(srcGlob, dstGlob);
                expect(this.myMover.commit.called).to.be.true;
            });

            it('should use defaults if none provided to init()', function () {
                const srcGlob = path.join(TEST_PATH, '*.a.b');
                const dstGlob = path.join(TEST_PATH, '*.up^');
                this.myController.init();
                //Calls exec() and asserts that nothing was thrown
                expect(() => this.myController.exec(srcGlob, dstGlob)).to.not.throw();
            });
        });

        describe('invoked without prior init() call', function () {
            it('should use defaults', function () {
                const srcGlob = path.join(TEST_PATH, '*doc');
                const dstGlob = path.join(TEST_PATH, '*pdf');
                let result;
                expect(() => { result = this.myController.exec(srcGlob, dstGlob); }).to.not.throw();
                expect(result).to.be.null;
            });

            it('should use objects provided to Controller.create()', function () {
                const srcGlob = path.join(TEST_PATH, '*txt');
                const dstGlob = path.join(TEST_PATH, '*TXT');
                const myParser  = Parser.create();
                const myRenamer = Renamer.create();
                const myMover   = Mover.create();
                const myController = Controller.create(myParser, myRenamer, myMover);

                sinon.spy(myParser, 'resolve');
                sinon.spy(myRenamer, 'computeName');
                sinon.spy(myMover, 'commit');

                expect(() => myController.exec(srcGlob, dstGlob)).to.not.throw();
                expect(myParser.resolve.called).to.be.true;
                expect(myRenamer.computeName.called).to.be.true;
                expect(myMover.commit.called).to.be.true;
            });

            it('should throw an Error if glob pattern is missing or invalid', function () {
                expect(() => this.myController.exec()).to.throw();
                expect(() => this.myController.exec('abc')).to.throw();
                expect(() => this.myController.exec('abc', [])).to.throw();
                expect(() => this.myController.exec(123, '123')).to.throw();
                expect(() => this.myController.exec('', '123')).to.throw();
                expect(() => this.myController.exec('abc', '')).to.throw();
                // Invalid because dest glob has more wildcards than source glob
                expect(() => this.myController.exec(path.join(TEST_PATH, '*'), path.join(TEST_PATH, '**'))).to.throw();
                expect(() => this.myController.exec(path.join(TEST_PATH, 'dotnames?.a.b'), path.join(TEST_PATH, '??_bad'))).to.throw();
            });

            it('should proceed renaming files based on provided globs and return the number of successful renames', function () {
                let srcGlob = path.join(TEST_PATH, '*.up^');
                let dstGlob = path.join(TEST_PATH, '*.z..');
                let dstFiles = globby.sync(dstGlob).concat(
                    globby.sync(srcGlob).map(function (filename) {
                        return filename.replace(/\.up\^$/, '.z..');
                    }));

                let result = this.myController.exec(srcGlob, dstGlob);

                // Asserts that original filenames no longer present after rename
                expect(globby.sync(srcGlob)).to.be.empty;
                expect(globby.sync(dstGlob).length).to.eql(4);
                expect(globby.sync(dstGlob)).to.have.members(dstFiles);
                expect(result).to.eql(2);

                // Cases with Windows path separator '\'
                srcGlob = 'test\\test-data\\\\dot*.?.*';
                dstGlob = 'test\\\\test-data2\\bot*.?';
                if (process.platform === 'win32') {
                    expect(globby.sync(srcGlob).length).to.eql(4);
                }
                else {
                    expect(globby.sync(srcGlob).length).to.eql(0);
                }
                expect(globby.sync('test/test-data2/*')).to.be.empty;
                result = this.myController.exec(srcGlob, dstGlob, (err) => { if (err) {console.log(err.message);} });
                if (process.platform === 'win32') {
                    expect(result).to.eql(4);
                    expect(globby.sync(srcGlob)).to.be.empty;
                    expect(globby.sync('test/test-data2/*').length).to.eql(4);
                    expect(globby.sync('test/test-data2/*.a')).to.have.members([ 'test/test-data2/botnames1.a', 'test/test-data2/botnames2.a' ]);
                    expect(globby.sync('test/test-data2/*.z')).to.have.members([ 'test/test-data2/botdotnames1.z', 'test/test-data2/botdotnames2.z']);
                }
                else {
                    // On Linux/Mac: there is no file matching 'test\test-data\\dot*.?.*'
                    expect(result).to.be.null;
                    expect(globby.sync('test/test-data2/*')).to.be.empty;
                }

            });

            it('should return null if no source file found, given the source glob', function () {
                let srcGlob = path.join(TEST_PATH, '*.missing');
                let dstGlob = path.join(TEST_PATH, '*.txt');
                const dstFiles = globby.sync(dstGlob);

                let result = this.myController.exec(srcGlob, dstGlob);

                expect(result).to.be.null;
                // Asserts that original filenames remain after operation
                expect(globby.sync(srcGlob).length).to.eql(0);
                expect(globby.sync(dstGlob)).to.have.members(dstFiles);

                // Case with Windows path separator '\'
                srcGlob = 'test\\\\test-data2\\\\';
                dstGlob = 'test\\test-data\\';
                result = this.myController.exec(srcGlob, dstGlob, (err) => { if (err) {console.log(err.message);} });
                // Linux/Mac: Expect null because no file matches 'test\\test-data2\\'
                // Windows: Expect null because Controller only processes files, not folders ('test\\test-data2\\' matches folder test-data2.
                expect(result).to.be.null;
            });
        });

        /* ----------------------------------------------------- */
        /* ------------ before() and after() section ----------- */
        /* ----------------------------------------------------- */
        before(function () {
            this.myParser   = Parser.create();
            this.myRenamer  = Renamer.create();
            this.myMover    = Mover.create();
            this.myController = Controller.create();
        });

        beforeEach(function () {
            const g = new FilenameGen();
            const extensions = ['txt', 'TXT', 'jpeg', 'JPEG', 'js', 'JS'];
            // Add peculiar filenames
            const specialNames = [ '^onecaret.up^', '^^onecaret.up^', '^twocarets.hi^^', '^^twocarets.hi^^',
                '$onedollar.tm$', '$$onedollar.tm$', '$twodollars.js$$', '$$twodollars.js$$',
                'dotnames1.a.b', 'dotnames2.a.b', 'dotdotnames1.z..', 'dotdotnames2.z..'];
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

            specialNames.forEach(function (name) {
                Object.defineProperty(folderContent, name, {
                    enumerable: true,
                    value: 'created by mock-fs'
                });
            });

            // creates mock test folder and files
            mockFs({
                'test/test-data': folderContent,
                'test/test-data2': {}
            });

            sinon.spy(this.myParser, "resolve");
            sinon.spy(this.myRenamer, "computeName");
            sinon.spy(this.myMover, "commit");
        });

        afterEach(function () {
            mockFs.restore();
            this.myParser.resolve.restore();
            this.myRenamer.computeName.restore();
            this.myMover.commit.restore();
        });
    });
});