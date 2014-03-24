// Load in library dependencies
var assert = require('assert');
var mustache = require('mustache');

// TODO: We should still probably draw out an automata diagram
// But... let's re-invent regular expressions with booleans

// TODO: We probably want one of these http://en.wikipedia.org/wiki/Backtracking

// This says depth first traversal. Let's do that and aim for the first working solution.

// TODO: Since mustache is ambiguous, we should require a schema to get our feet off the ground. It will significantly help with nested info
// DEV: If we were to use regular expressions, we would lose accuracy of re-using variable values

// TODO: Instead of deep clone, consider prototypal lookup for tokens
function Context(content, parentContext) {
  this.meta = {
    length: 0,
    completedContent: '',
    remainingContent: content
  };
  this.tokensByName = {};
  this.parent = null;
}
Context.prototype = {
  // Add a new string to the context
  addStr: function (str) {
    this.meta.length += str.length;
    this.meta.completedContent += str;
    this.meta.remainingContent = this.meta.remainingContent.slice(str.length);
  },

  // Update a token on the context
  setToken: function (key, val) {
    this.tokensByName[key] = val;
  }
};

// TODO: Should this be a new method of a mustache template?
function reverseMustache(params) {
  // Make assertions about parameters
  assert(params, '`reverseMustache` expects `params` to be provided');
  assert(params.template, '`reverseMustache` expects `params.template` to be provided');
  assert(params.content, '`reverseMustache` expects `params.content` to be provided');

  // Interpret and localize parameters
  var ast = mustache.parse(params.template);
  var content = params.content;

  // Define recursive function to perform depth-first traversal
  function dfs(content, tokens) {
    var i = 0;
    var len = tokens.length;
    // TODO: We should be re-using tokensByName from top-levels (via deep clone)
    // TODO: Figure out how the hell to deal with subpaths (maybe getval, setval)
    // TODO: We are going to need to use sub-tokensByName as with mustache. Maybe re-use their lookup tooling?
    var context = new Context(content);
    for (; i < len; i++) {
      var token = tokens[i];
      var type = token[0];
      switch (type) {
        case '#': // If/loop
          // Treat as `if` for now
          // TODO: This is going to have to stop matching the subcontent at some point
          // hello {{moon}} and more
          var subtokens = token[4];
          var result = dfs(context.meta.remainingContent, subtokens);

          // If the content matched, save our boolean as true
          if (result) {
            context.setToken(token[1], true);
            context.addStr(result.meta.completedContent);
          // Otherwise, mark the boolean as false
          // DEV: This will fail on future steps if it is not `false` either
          } else {
            context.setToken(token[1], false);
          }
          break;
        case 'text': // Text
          // Slice the next snippet of text
          var expectedText = token[1];
          var actualText = content.slice(0, expectedText.length);

          // If it does not match, reject it
          if (actualText !== expectedText) {
            // TODO: This shouldn't be a return but walk back in `for` loop for previous decisions (e.g. `true` over `false`)
            return null;
          } else {
            context.addStr(expectedText);
          }
          break;
      }
    }
    return context;
  }

  // Run our depth first traversal
  return dfs(content, ast);
}

// Export `reverseMustache`
module.exports = reverseMustache;
