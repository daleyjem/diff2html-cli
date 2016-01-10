/*
 *
 * Diff to HTML CLI (cli.js)
 * Author: rtfpessoa
 *
 */

(function() {

  var diff2Html = require('diff2html').Diff2Html;

  var log = require('./logger.js').Logger;
  var http = require('./http-utils.js').HttpUtils;
  var utils = require('./utils.js').Utils;

  function Diff2HtmlInterface() {
  }

  /*
   * Input
   */

  Diff2HtmlInterface.prototype.getInput = function getInput(inputType, inputArgs, callback) {
    var that = this;
    switch (inputType) {
      case 'file':
        utils.readFile(inputArgs[0], callback);
        break;

      case 'stdin':
        utils.readStdin(callback);
        break;

      default:
        that._runGitDiff(inputArgs, callback);
    }
  };

  Diff2HtmlInterface.prototype._runGitDiff = function(gitArgsArr, callback) {
    var gitArgs;
    if (gitArgsArr.length && gitArgsArr[0]) {
      gitArgs = gitArgsArr.join(' ');
    } else {
      gitArgs = '-M HEAD~1';
    }

    var diffCommand = 'git diff ' + gitArgs;
    return callback(null, utils.runCmd(diffCommand));
  };

  /*
   * Output
   */

  Diff2HtmlInterface.prototype.getOutput = function(baseConfig, input, callback) {
    var that = this;
    var config = baseConfig;
    config.wordByWord = (baseConfig.diff === 'word');
    config.charByChar = (baseConfig.diff === 'char');

    var jsonContent = diff2Html.getJsonFromDiff(input, config);

    if (baseConfig.format === 'html') {
      config.inputFormat = 'json';

      if (baseConfig.style === 'side') {
        config.outputFormat = 'side-by-side';
      } else {
        config.outputFormat = 'line-by-line';
      }

      if (baseConfig.summary) {
        config.showFiles = true;
      }

      var htmlContent = Diff2Html.getPrettyHtml(jsonContent, config);
      return callback(null, that._prepareHTML(htmlContent));
    } else if (baseConfig.format === 'json') {
      return callback(null, JSON.stringify(jsonContent));
    }

    return callback(new Error('Wrong output format `' + baseConfig.format + '`!'));
  };

  Diff2HtmlInterface.prototype._prepareHTML = function(content) {
    var template = utils.readFileSync(__dirname + '/../dist/template.html');

    var cssFile = __dirname + '/../node_modules/diff2html/css/diff2html.css';
    var cssFallbackFile = __dirname + '/../dist/diff2html.css';
    if (utils.existsSync(cssFile)) cssFile = cssFallbackFile;

    var cssContent = utils.readFileSync(cssFile);

    return template
      .replace('<!--css-->', '<style>\n' + cssContent + '\n</style>')
      .replace('<!--diff-->', content);
  };

  /*
   * Output destination
   */

  Diff2HtmlInterface.prototype.preview = function(content, format) {
    var filePath = '/tmp/diff.' + format;
    utils.writeFile(filePath, content);
    utils.runCmd('open ' + filePath);
  };

  Diff2HtmlInterface.prototype.postToDiffy = function(diff, postType) {
    var jsonParams = {udiff: diff};

    http.post('http://diffy.org/api/new', jsonParams, function(err, response) {
      if (err) {
        log.error(err);
        return;
      }

      if (response.status !== 'error') {
        log.print('Link powered by diffy.org:');
        log.print(response.url);

        if (postType === 'browser') {
          utils.runCmd('open ' + response.url);
        } else if (postType === 'pbcopy') {
          utils.runCmd('echo "' + response.url + '" | pbcopy');
        }
      } else {
        log.error('Error: ' + message);
      }
    });
  };

  module.exports.Diff2HtmlInterface = new Diff2HtmlInterface();

})();
