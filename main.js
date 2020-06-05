var debug = require("./debug")
debug.begin('program')

var Lexer = require('./lexer');
var LexerRuleset = require('./lexerRuleset');
var fs = require('fs');
var Parser = require("./parser.js");
var Decomposer = require("./decomposer.js");
var Runtime = require("./runtime.js").Runtime
var Env = require("./runtime.js").Env
var node = require("./node")
var fs = require('fs');

var lexer = new Lexer();
var ruleset = new LexerRuleset();
let decomposer = new Decomposer();
let parser = new Parser();
let runtime = new Runtime();

ruleset.add(/[0-9]+/g, "NUMBER");
ruleset.add(/if/g, "KEYWORD");
ruleset.add(/else/g, "KEYWORD");
ruleset.add(/while/g, "KEYWORD");
ruleset.add(/func/g, "KEYWORD");
ruleset.add(/true/g, "BOOL");
ruleset.add(/false/g, "BOOL");
ruleset.add(/\/\//g, "COMMENT");
ruleset.add(/\/\*/g, "COMMENTO");
ruleset.add(/\*\//g, "COMMENTC");
ruleset.add(/\&\&/g, "OPERATOR");
ruleset.add(/\|\|/g, "OPERATOR");
ruleset.add(/\=\=/g, "OPERATOR");
ruleset.add(/\=/g, "OPERATOR");
ruleset.add(/\!\=/g, "OPERATOR");
ruleset.add(/\<\=/g, "OPERATOR");
ruleset.add(/\>\=/g, "OPERATOR");
ruleset.add(/\</g, "OPERATOR");
ruleset.add(/\>/g, "OPERATOR");
ruleset.add(/\+/g, "OPERATOR");
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

// console.log("\033[0;34m++++++ LEXER RESULT ++++++\u001b[0m");
// console.log(tokens);

// console.log("\033[0;34m++++++ PARSER RESULT ++++++\u001b[0m");
let t = parser.parse(tokens)
// console.log(JSON.stringify(t));
// console.log("\033[0;34m++++++ DECOMPOSER RESULT ++++++\u001b[0m");
let code = decomposer.decompose(t);
fs.writeFile('_debug_decomposer_output.txt', Decomposer.fancy(code), 'utf8', (...a) => { });
console.log("\033[0;34m++++++ RUN RESULT ++++++\u001b[0m");


runtime.rootEnv = new Env()

runtime.rootEnv.setFunction("stdout", (runtime, env) => {
    let v = runtime.pop()
  
    v = Runtime.dump(v)
    console.log(v)

    return node.Node.newString(v)
})

runtime.rootEnv.setFunction("newline", (runtime, env) => {
    return node.Node.newString("\n");
})



let protoClass = runtime.rootEnv.setv("Prototype", node.Node.newTable({}, 0))
protoClass.tset(node.Node.newString("set"), node.Node.newFun((runtime, env) => {
    let dest = runtime.pop()
    let src = runtime.pop()
    return dest.tsetProto(src)
}))

runtime.rootEnv.setFunction("rand", (runtime, env) => {
    let min = runtime.pop().value
    let max = runtime.pop().value
  
    return node.Node.newNumber(Math.floor(Math.random() * (+max - +min)) + +min)
})

Runtime.dump(runtime.run(code))
console.log("\033[0;34m++++++ END OF RUN ++++++\u001b[0m");




debug.end('program')
console.log('\u001b[0;34m\n\n-----=====     STATS     =====-----\u001b[0m')
console.log('Tokens count:', tokens.length);
console.log('VM code size:', code.length);
console.log('Debug timers:');
debug.dumpTimers();

console.log('--==  ENCODER  ==--')
const Encoder = require('./encoder');
let value = [125, false, null, true, [1, 2, 3], '｡ﾟ(TヮT)ﾟ｡', 2.5];
let data = Encoder.encode(value);
console.log('value :', value);
console.log('encode :', data);
for (let i = 0; i < data.byteLength; ++i)
    console.log(`decode(${i}) :`, Encoder.decode(data, i));

// console.log(JSON.stringify(debug.timers[0], null, '  '));
