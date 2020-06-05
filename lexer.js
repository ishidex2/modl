let LexerRuleset = require('./lexerRuleset');
let Token = require('./token');
let debug = require("./debug");

module.exports = class Lexer
{
    /**
     * @param {RegExp} rule 
     * @param {String} source 
     * @param {Number} position 
     */
    occurency(rule, source, position)
    {
        source = source.substr(position);
        rule = new RegExp(rule);

        let match = rule.exec(source);

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
        debug.begin('lex');
        
        let splitSource = source.split("\n");
        let pos = 0;
        let result = [];
        let self = this;
        let line = 0;
        let isComment = false;
        let commentLine = null;
        while (pos < source.length)
        {
            let occurency = null;
            let found = false;
            for (let i = 0; i < ruleset.tokens.length; i++)
            {
                occurency = self.occurency(ruleset.tokens[i].expr, source, pos);


                if (occurency.found)
                {

                    if (ruleset.tokens[i].type == "NOTHING" || ruleset.tokens[i].type == "NEWLINE") 
                    {
                        if (ruleset.tokens[i].type == "NEWLINE")
                        {
                            line += 1;
                        }
                        pos += occurency.match[0].length;
                        // console.log(occurency.match[0].length);

                        found = true;
                        break;
                    }

                    if (isComment && commentLine == line)
                    {
                        pos += occurency.match[0].length;
                        found = true;
                        break;
                    }

                    else 
                    {
                        commentLine = null
                        isComment = false
                    }

                    if (ruleset.tokens[i].type == "COMMENT")
                    {
                        pos += occurency.match[0].length;
                        isComment = true;
                        commentLine = line
                        found = true;
                        break;
                    }

                    found = true;
                    // if (ruleset.tokens[i].type == "STRING")
                    // {
                    //   console.log(source.substr(pos));
                    // }
                    result.push(new Token(occurency.match[0], ruleset.tokens[i].type, line, splitSource[line]));
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

        debug.end('lex');
        return result;
    }
}
