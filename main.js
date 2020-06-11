var debug = require("./debug")
debug.begin('program')

var Lexer = require('./lexer');
var LexerRuleset = require('./lexerRuleset');
var fs = require('fs');
var Parser = require("./parser.js");
var Runtime = require("./runtime.js").Runtime
var Decomposer = require("./decomposer");
var Env = require("./runtime.js").Env
var node = require("./node")
var fs = require('fs');

var decomposer = new Decomposer();
var lexer = new Lexer();
var ruleset = new LexerRuleset();
let parser = new Parser();
let runtime = new Runtime();

ruleset.add(/[0-9]+\.?[0-9]*/g, "NUMBER");
ruleset.add(/if/g, "KEYWORD");
ruleset.add(/else/g, "KEYWORD");
ruleset.add(/while/g, "KEYWORD");
ruleset.add(/nil/g, "NIL");
ruleset.add(/func/g, "KEYWORD");
ruleset.add(/true/g, "BOOL");
ruleset.add(/false/g, "BOOL");
ruleset.add(/\/\//g, "COMMENT");
ruleset.add(/\/\*/g, "COMMENTO");
ruleset.add(/\*\//g, "COMMENTC");
ruleset.add(/\&\&/g, "OPERATOR");
ruleset.add(/\|\|/g, "OPERATOR");
ruleset.add(/\|/g, "OPERATOR");
ruleset.add(/\=\=/g, "OPERATOR");
ruleset.add(/\=/g, "OPERATOR");
ruleset.add(/\!\=/g, "OPERATOR");
ruleset.add(/\<\=/g, "OPERATOR");
ruleset.add(/\>\=/g, "OPERATOR");
ruleset.add(/\</g, "OPERATOR");
ruleset.add(/\>/g, "OPERATOR");
ruleset.add(/\+/g, "OPERATOR");
ruleset.add(/\~/g, "OPERATOR");
ruleset.add(/\^/g, "OPERATOR");
ruleset.add(/\-/g, "OPERATOR");
ruleset.add(/\*/g, "OPERATOR");
ruleset.add(/\#/g, "OPERATOR");
ruleset.add(/\//g, "OPERATOR");
ruleset.add(/\:\:/g, "ACCESS");
ruleset.add(/\./g, "ACCESS");
ruleset.add(/\=\>/g, "THUS");
ruleset.add(/\,/g, "SEPARATE");
ruleset.add(/\;/g, "SEPARATE");
ruleset.add(/\:/g, "SEPARATE");
ruleset.add(/\{/g, "CBOPEN");
ruleset.add(/\}/g, "CBCLOSE");;
ruleset.add(/\[/g, "SBOPEN");
ruleset.add(/\]/g, "SBCLOSE");
ruleset.add(/\(/g, "SCOPE_OPEN");
ruleset.add(/\)/g, "SCOPE_EXIT");
ruleset.add(/\n/g, "NEWLINE");
ruleset.add(/\s/g, "NOTHING");
ruleset.add(/\".*?\"/g, "STRING");
ruleset.add(/\'.*?\'/g, "STRING");
ruleset.add(/[a-zA-Z_]+/g, "IDENTIFIER");

var tokens = lexer.lex(ruleset, fs.readFileSync("./test.modl").toString());

console.log("\033[0;34m++++++ LEXER RESULT ++++++\u001b[0m");
console.log(tokens);

console.log("\033[0;34m++++++ PARSER RESULT ++++++\u001b[0m");
let t = parser.parse(tokens);
console.log(t);

console.log("\033[0;34m++++++ DECOMPOSER RESULT ++++++\u001b[0m");
let code = decomposer.start(t);
let r = "";
for (let i = 0; i < code.length; i++)
{
    r += (`\\x${code[i].toString(16).padStart(2, "0")}`);
}
console.log(r);


