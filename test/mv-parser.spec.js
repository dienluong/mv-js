'use strict';

const mockFs    = require('mock-fs');
const globby    = require('globby');
const fs        = require('fs');
const path      = require('path').posix;
const FilenameGenerator = require('natural-filename-generator');

const expect  = require('chai').expect;
const sinon   = require('sinon');

const parser  = require('../src/mv-parser');
const TEST_PATH = path.join('test', 'test-data');

describe('mv-parser', function () {
    describe('resolve()', function () {
        it('should throw an Error if glob pattern argument is not a string', function () {
            let pattern = 123;

            try {
                this.myParser.resolve(pattern);
            }
            catch (e) {
                expect(e).to.be.instanceof(TypeError)
                .and.have.property('message', 'Glob pattern must be a string.');
            }

            expect(this.myParser.resolve.alwaysThrew('TypeError')).to.be.true;
        });

        it('should return [] if no file matched', function () {
            let pattern = path.join(TEST_PATH, '*.bob');
            let result = this.myParser.resolve(pattern);
            expect(result).to.be.empty;
            expect(result).to.eql(globby.sync(pattern));

            pattern = '*.txt';
            result = this.myParser.resolve(pattern);
            expect(result).to.be.empty;
            expect(result).to.eql(globby.sync(pattern));

            pattern = '*.txt/';
            result = this.myParser.resolve(pattern);
            expect(result).to.be.empty;
            expect(result).to.eql(globby.sync(pattern));

            pattern = path.join('.', '*.JPEG');
            result = this.myParser.resolve(pattern);
            expect(result).to.be.empty;
            expect(result).to.be.eql(globby.sync(pattern));

            expect(this.myParser.resolve.alwaysReturned([])).to.be.true;
        });

        it('should return array of file names matching glob pattern', function () {
            // Test pattern "path/*.txt"
            let pattern = path.join(TEST_PATH, '*.txt');
            let result = this.myParser.resolve(pattern);
            // Check with source array (fullnamesMap)
            let sourceNames = this.fullnamesMap.get('txt');
            expect(result).to.have.members(sourceNames);
            // Cross-check with result from another glob module: globby
            let globbyResult = globby.sync(pattern);
            expect(result).to.eql(globbyResult);

            // Test pattern "path/*"
            pattern = path.join(TEST_PATH, '*');
            result = this.myParser.resolve(pattern);
            // Note: Array.from returns an array of array; using Array.concat to flatten the arrays
            sourceNames = [].concat.apply([], Array.from(this.fullnamesMap.values()));
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.eql(globbyResult);
            result = result.map(function (res) {
                return path.basename(res);
            });
            expect(result).to.have.members(fs.readdirSync(TEST_PATH));

            // Test pattern "path/*.JP?G"
            pattern = path.join(TEST_PATH, '*.JP?G');
            result = this.myParser.resolve(pattern);
            sourceNames = this.fullnamesMap.get('JPEG');
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.eql(globbyResult);

            // Test pattern "path/*.a.b
            pattern = path.join(TEST_PATH, '*.a.b');
            result = this.myParser.resolve(pattern);
            sourceNames = this.fullnamesMap.get('a.b');
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.be.eql(globbyResult);

            // Test pattern "path/*.z..
            pattern = path.join(TEST_PATH, '*.z..');
            result = this.myParser.resolve(pattern);
            sourceNames = this.fullnamesMap.get('z..');
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.be.eql(globbyResult);

            // Test pattern "path/*^
            pattern = path.join(TEST_PATH, '*^');
            result = this.myParser.resolve(pattern);
            sourceNames = this.fullnamesMap.get('up^');
            sourceNames = sourceNames.concat(this.fullnamesMap.get('hi^^'));
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.be.eql(globbyResult);

            // Test pattern "path/^*.???
            pattern = path.join(TEST_PATH, '^*.???');
            result = this.myParser.resolve(pattern);
            sourceNames = this.fullnamesMap.get('up^');
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.be.eql(globbyResult);

            // Test pattern "path/$$*.???$
            pattern = path.join(TEST_PATH, '$$*.???$');
            result = this.myParser.resolve(pattern);
            sourceNames = [ path.join(TEST_PATH, '$$twodollars.js$$') ];
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.be.eql(globbyResult);

            // Test pattern "path/*.js*
            pattern = path.join(TEST_PATH, '*.js*');
            result = this.myParser.resolve(pattern);
            sourceNames = this.fullnamesMap.get('js');
            sourceNames = sourceNames.concat(this.fullnamesMap.get('js$$'));
            expect(result).to.have.members(sourceNames);
            globbyResult = globby.sync(pattern);
            expect(result).to.be.eql(globbyResult);

            // Test pattern where path contains wildcards
            pattern = path.join('*t', '?es?-**', '*.j???*');
            result = this.myParser.resolve(pattern);
            expect(result).to.have.members(this.fullnamesMap.get('jpeg').concat(this.fullnamesMap.get('js$$')));
            expect(result).to.be.eql(globby.sync(pattern));
            pattern = path.join('*t', '?es?-**', '*.txt');
            result = this.myParser.resolve(pattern);
            expect(result).to.have.members(this.fullnamesMap.get('txt').concat([ 'test/test-data2/abc.txt' ]));
            expect(result).to.be.eql(globby.sync(pattern));

            // Test names containing parens
            pattern = path.join(TEST_PATH, ')Tpop(tarts');
            result = this.myParser.resolve(pattern);
            expect(result.length).to.eql(1);
            expect(result).to.have.members([ this.fullnamesMap.get('parens')[0] ]);
            expect(result).to.be.eql(globby.sync(pattern));
            pattern = path.join(TEST_PATH, 'pop(tarts)TXT');
            result = this.myParser.resolve(pattern);
            expect(result.length).to.eql(1);
            expect(result).to.have.members([ this.fullnamesMap.get('parens')[1] ]);
            expect(result).to.be.eql(globby.sync(pattern));

            // Test paths using \ as separator (Windows)
            pattern = 'test\\\\test-data\\';
            result = this.myParser.resolve(pattern);
            // Linux/Mac: Expect empty result because file 'test\\test-data\' does not exist
            // Windows: Expect empty result because nodir option is set to true
            expect(result.length).to.eql(0);
            pattern = 'test\\\\\\test-data\\\\)Tpop(tarts';
            result = this.myParser.resolve(pattern);
            if (process.platform === 'win32') {
                expect(result.length).to.eql(1);
            }
            else {
                expect(result.length).to.eql(0);
            }

            expect(result).to.be.eql(globby.sync(pattern));

            const options = {
                nobrace: true,
                noglobstar: true,
                noext: true,
                nodir: true,
            };
            // Test with / separator
            pattern = 'test/test-data//';
            result = this.myParser.resolve(pattern, options);
            // Expect empty result because nodir option is set to true
            expect(result.length).to.eql(0);
            pattern = 'test//test-data*///*.txt';
            result = this.myParser.resolve(pattern, options);
            expect(result.length).to.eql(3);
            expect(result).to.eql(globby.sync(pattern));
        });


        /* ----------------------------------------------------- */
        /* ------------ before() and after() section ----------- */
        /* ----------------------------------------------------- */
        beforeEach(function () {
            const g = new FilenameGenerator();
            const extensions = ['txt', 'TXT', 'jpeg', 'JPEG', 'js', 'JS'];
            let folderContent = {};
            this.fullnamesMap = new Map();

            // Build a Map of all files.  Key is the file extension and value is an array of the filenames with that extension
            // Also builds the object "folderContent" for mock-fs
            for (let i = extensions.length - 1; i >= 0; i -= 1) {
                const name1 = g.generate(extensions[i]);
                const name2 = g.generate(extensions[i]);
                let names = [ path.join(TEST_PATH, name1), path.join(TEST_PATH, name2) ];
                this.fullnamesMap.set(extensions[i], names);
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
                                'dotnames1.a.b', 'dotnames2.a.b', 'dotdotnames1.z..', 'dotdotnames2.z..',
                                ')Tpop(tarts', 'pop(tarts)TXT'];
            this.fullnamesMap.set('up^', [ path.join(TEST_PATH, specialNames[0]), path.join(TEST_PATH, specialNames[1]) ]);
            this.fullnamesMap.set('hi^^', [ path.join(TEST_PATH, specialNames[2]), path.join(TEST_PATH, specialNames[3]) ]);
            this.fullnamesMap.set('tm$', [ path.join(TEST_PATH, specialNames[4]), path.join(TEST_PATH, specialNames[5]) ]);
            this.fullnamesMap.set('js$$', [ path.join(TEST_PATH, specialNames[6]), path.join(TEST_PATH, specialNames[7]) ]);
            this.fullnamesMap.set('a.b', [ path.join(TEST_PATH, specialNames[8]), path.join(TEST_PATH, specialNames[9]) ]);
            this.fullnamesMap.set('z..', [ path.join(TEST_PATH, specialNames[10]), path.join(TEST_PATH, specialNames[11]) ]);
            this.fullnamesMap.set('parens', [ path.join(TEST_PATH, specialNames[12]), path.join(TEST_PATH, specialNames[13]) ]);
            specialNames.forEach(function (name) {
               Object.defineProperty(folderContent, name, {
                   enumerable: true,
                   value: 'created by mock-fs'
               });
            });

            // creates mock test folder and files
            mockFs({
                'test/test-data': folderContent,
                'test/test-data2': {
                    'abc.txt': 'created by mock-fs'
                }
            });

            this.myParser = parser.create();
            sinon.spy(this.myParser, 'resolve');
        });

        afterEach(function () {
            mockFs.restore();
            this.myParser.resolve.restore();
        });
    });
});
