var LexerRuleset = require('./lexerRuleset');
var Token = require('./token');

module.exports = class Lexer
{
  /**
   * 
   * @param {RegExp} rule 
   * @param {String} source 
   * @param {Number} position 
   */
  occurency(rule, source, position)
  {
    source = source.substr(position);
    rule = new RegExp(rule);

    var match = rule.exec(source);

    if (!match)
    {
      return {
        match: match,
        found: false,
        illegal: false
      }
    }
    if (match.index == 0)
    {
      // console.log(match);

      return {
        match: match,
        found: true,
        illegal: false
      }
    }
    else
    {
      return {
        match: match,
        found: false,
        // illegal: true
      } 
    }
  }



  lex(ruleset, source)
  {
    var pos = 0;
    var result = [];
    var self = this;
    while (pos < source.length)
    {
      var occurency = null;
      var found = false;
      for (var i = 0; i < ruleset.tokens.length; i++)
      {
        occurency = self.occurency(ruleset.tokens[i].expr, source, pos);
        
        
        if (occurency.found)
        {
          if (ruleset.tokens[i].type == "NOTHING") 
          {
            pos += occurency.match[0].length;
            // console.log(occurency.match[0].length);

            found = true;
            break;
          }

          found = true;
          // if (ruleset.tokens[i].type == "STRING")
          // {
          //   console.log(source.substr(pos));
          // }
          result.push(new Token(occurency.match[0], ruleset.tokens[i].type));
          pos += occurency.match[0].length;
          break;
        }
      }
      if (!found)
      {
        console.error(`Illegal character  ' ${source[pos]} ' at ${pos}`);
        process.exit(-1);
      }
    }
    return result;
  }
}  
