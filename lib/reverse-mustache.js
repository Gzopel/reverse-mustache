// Load in library dependencies
var assert = require('assert');
var mustache = require('mustache');
var deepClone = require('clone');

// TODO: We should still probably draw out an automata diagram
// But... let's re-invent regular expressions with booleans

// TODO: We probably want one of these http://en.wikipedia.org/wiki/Backtracking

// This says depth first traversal. Let's do that and aim for the first working solution.

// TODO: Since mustache is ambiguous, we should require a schema to get our feet off the ground. It will significantly help with nested info
// DEV: If we were to use regular expressions, we would lose accuracy of re-using variable values

// TODO: Can we break each of these recursive items into its own function? I ask because the function is getting large.

// TODO: Instead of deep clone, consider prototypal lookup for tokens
function Context(content) {
  // Set up content and token internals
  this.originalContent = content;
  this.remainingContent = content || '';
  this.completedContent = '';
  this.tokensByName = {};
}
Context.prototype = {
  // Add a new string to the context
  addStr: function (str) {
    // Assert we are not adding in content that is unwanted
    var expectedStr = this.remainingContent.slice(0, str.length);
    assert.strictEqual(str, expectedStr, '`Context#addStr` received bad match for `remainingContent`. Expected: "' + expectedStr + '", Actual: "' + str + '"');

    // Update remaining and completed content
    this.remainingContent = this.remainingContent.slice(str.length);
    this.completedContent += str;
  },

  // Update a token on the context
  setToken: function (key, val) {
    // Assert the token is not yet set
    // DEV: Even if they are the same, we are missing an optimization by reusing that knowledge
    assert.strictEqual(this.tokensByName.hasOwnProperty(key), false, '`Context#setToken` expected `tokensByName["' + key + '"]` to not be defined but it was.');

    // Set the value
    this.tokensByName[key] = val;
  },

  // Duplicate context (useful for exploring potential subcases)
  clone: function () {
    var context = new Context(this.originalContent);
    context.remainingContent = this.remainingContent;
    context.completedContent = this.completedContent;
    context.tokensByName = deepClone(this.tokensByName);
    return context;
  },

  // Add results from another context (e.g. subcases)
  addContext: function (context) {
    // Assert the context is not null
    assert(context, '`Context#addContext` received `null`, this is probably due to a bad check of `result` being truthy for inheritance.');

    // Add the content
    this.addStr(context.completedContent);

    // Copy over tokens
    var tokenNames = Object.getOwnPropertyNames(context.tokensByName);
    var i = 0;
    var len = tokenNames.length;
    for (; i < len; i++) {
      var tokenName = tokenNames[i];
      this.setToken(tokenName, context.tokensByName[tokenName]);
    }
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
    var token = tokens[0];

    // TODO: We should be re-using tokensByName from top-levels (via deep clone)
    // TODO: Figure out how the hell to deal with subpaths (maybe getval, setval)
    // TODO: We are going to need to use sub-tokensByName as with mustache. Maybe re-use their lookup tooling?
    var context = new Context(content);

    // If there are no tokens left, return context
    // TODO: Is this the right thing to do?
    if (!token) {
      return context;
    }

    // Depending on the type of the token
    var type = token[0];
    switch (type) {
      case '#': // If/loop
        // Treat as `if` for now
        // TODO: This is going to have to stop matching the subcontent at some point
        // hello {{moon}} and more
        var subtokens = token[4];
        var subresult = dfs(context.remainingContent, subtokens);

        // If the content matched, attempt to save our boolean as true
        // DEV: We make this as an attempt because future content could be invalid
        if (subresult) {
          // Set up exploratory case for conditional being true
          var proposedContext = context.clone();
          proposedContext.setToken(token[1], true);
          proposedContext.addStr(subresult.completedContent);

          // Explore the tokens within our conditional
          var result = dfs(proposedContext.remainingContent, tokens.slice(1));

          // If we matched
          if (result) {
            // Accept proposed context, add our sub result, and return
            context = proposedContext;
            context.addContext(result);
            return context;
          }

          // Otherwise, continue to false
        }

        // Mark the boolean as false
        // DEV: This will fail on future steps if it is not `false` either
        context.setToken(token[1], false);
        var result = dfs(context.remainingContent, tokens.slice(1));

        // If there was a result, inherit and return
        // TODO: We need to do this for all of our inheritance, is there a pattern for this?
        if (result) {
          context.addContext(result);
          return context;
        // Otherwise, return null
        } else {
          return null;
        }
      case 'name': // Variable
        // Looping from the entire remaining string to the first character (varying width, fixed at the first character)
        // DEV: This is a greedy regular expression. yey.
        var remainingContent = context.remainingContent;
        var i = remainingContent.length;
        while (i >= 0) {
          // Attempt to use the substring as a match
          // TODO: There can probably be optimizations for trimming left content (a la quicksort) or even better regexp engines
          var proposedContext = context.clone();
          proposedContext.addStr(remainingContent.slice(0, i));
          var proposedResult = dfs(proposedContext.remainingContent, tokens.slice(1));
          console.log(proposedResult, i);

          // If we matched successfully, use the proposed result and context
          // DEV: If we ever do a `matchAll` method, this will make every other action run `n` times (i.e. n^m runtime, n = characters, m = decisions)
          if (proposedResult) {
            context = proposedContext;
            context.addContext(proposedResult);
            return context;
          // Otherwise, continue
          } else {
            i += 1;
            continue;
          }
        }
        break;
      case 'text': // Text
        // Slice the next snippet of text
        var expectedText = token[1];
        var actualText = context.remainingContent.slice(0, expectedText.length);

        // If it does not match, reject it
        if (actualText !== expectedText) {
          // TODO: This shouldn't be a return but walk back in `for` loop for previous decisions (e.g. `true` over `false`)
          return null;
        } else {
          context.addStr(expectedText);

          var result = dfs(context.remainingContent, tokens.slice(1));
          if (result) {
            context.addContext(result);
            return context;
          } else {
            return null;
          }
        }
        break;
      default:
        throw new Error('`reverseMustache` did not recognize type "' + type + '" for token ' + JSON.stringify(token));
    }
  }

  // Run our depth first traversal
  var result = dfs(content, ast);

  // If there was a result and there is remaining content, return negatively
  if (result && result.remainingContent !== '') {
    return null;
  // Otherwise, return the result
  } else {
    return result;
  }
}

// Export `reverseMustache`
module.exports = reverseMustache;
