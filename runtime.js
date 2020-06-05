
// '||': 'OR',
// '&&': 'AND',
// '<': 'LES',
// '>': 'MOR',
// '<=': 'LOE',
// '>=': 'MOE',
// '==': 'EQU',
// '!=': 'NEQ',
// '+': 'ADD',
// '-': 'SUB',
// '*': 'MUL',
// '/': 'DIV'

let node = require("./node")

class Env
{
    constructor()
    {
        this.entries = {};
        this.parent = null
    }

    setFunction(id, fn)
    {
        this.entries[id] = node.Node.newFun(fn)
    }

    setv(id, v)
    {
        if (!this.entries[id] && this.parent)
        {
            this.parent.setv(id, v)
        }
        this.entries[id] = v
        return v
    }

    getv(id)
    {
        return this.entries[id] ? this.entries[id] : (this.parent === null ? node.Node.newNil() : this.parent.getv(id))
    }
}

class Runtime
{
    pop()
    {
        let t = this.stack.pop();
        // console.log("<< ", this.stack.map(e => node.Node.dump(e)), " on ", this.ip)
        return t ? t : node.Node.newNil()
    }

    push(v)
    {
        if (!v) return;

        this.stack.push(v)
        // console.log(">> ", this.stack.map(e => node.Node.dump(e)), " on ", this.ip)
    }

    call(ip)
    {
        this.callStack.push(this.ip);
        // console.log(ip)
        this.ip = ip-1;
    }

    run(prog)
    {
        this.prog = prog
        this.env = this.rootEnv;
        this.stack = []
        this.callStack = []
        this.callArgCount = []
        this.ip = 0

        let lr = (fn) => {
            let rparam = this.pop()
            let lparam = this.pop()
            return fn(lparam, rparam)
        }
        
        while (this.ip < this.prog.length)
        {
            
            switch (this.prog[this.ip][0])
            {
                case "POP":
                    this.pop()
                    break;

                case "PUSH":
                    this.push(this.prog[this.ip][1])
                    break;

                case "NEWTBL":
                    this.push(node.Node.newTable({}, this.prog[this.ip][1]))
                    break;
                
                case "RET":
                    this.ip = this.callStack.pop()
                    if (this.ip == null)
                    {
                        throw new Exception("Returning from nothing (most likely internal error)");
                    }
                    break;

                case "STORE":
                    this.push(this.env.setv(this.prog[this.ip][1], this.pop()))
                    break;

                case "LOAD":
                    this.push(this.env.getv(this.prog[this.ip][1]))
                    break;

                case "CALLCNT":
                    this.callArgCount.push(this.prog[this.ip][1])
                    break;

                case "CHKARGS":
                    if (this.callArgCount[this.callArgCount.length-1] > this.prog[this.ip][1])
                    {
                        throw new Error("Passed too much arguments to a function");
                    }
                    break;

                case "ENVPSH":
                    let e = new Env();
                    e.parent = this.env;
                    this.env = e;
                    break;
                    
                case "ENVPOP":
                    this.env = this.env.parent;
                    break;
                // Flow

                case "CALL":
                    this.push(this.pop().call(this, this.env))                    
                    break;
                
                case "JMP":
                    // console.log("======================")
                    this.ip = this.prog[this.ip][1]-1
                    break;

                case "JIFN":
                    if (!this.pop().value)
                        this.ip = this.prog[this.ip][1]-1
                    break;
            

                // Table
                case "TBLSET":
                    this.push(this.pop().tset(this.pop(), this.pop()))
                    break;

                case "TBLSETI":
                    this.push(this.pop().tset(this.pop(), this.pop(), false))
                    break;

                case "TBLGET":
                    this.push(this.pop().tget(this.pop()))
                    break;

                case "TBLPSH":
                    this.push(this.pop().push(this.pop()))
                    break;
                    
                case "TBLPSHR":
                    let rvalue = this.pop();
                    let lvalue = this.pop();
                    this.push(lvalue.push(rvalue))
                    break;

                // Math
                case "NOT":
                    this.push(node.Node.newNumber(!this.pop().value))                    
                    break;

                case "NEG":
                    this.push(node.Node.newNumber(-this.pop().value))
                
                    break;

                case "LEN":
                    this.push(this.pop().length())
                    break;

                case "OR":
                    this.push(lr((l, r) => node.Node.newNumber(l.value || r.value)))
                    break;

                case "AND":
                    this.push(lr((l, r) => node.Node.newNumber(l.value && r.value)))
                    break;

                case "LES":
                    this.push(lr((l, r) => node.Node.newNumber(l.value < r.value)))
                    break;
                
                case "MOR":
                    this.push(lr((l, r) => node.Node.newNumber(l.value > r.value)))
                    break;
                
                case "LOE":
                    this.push(lr((l, r) => node.Node.newNumber(l.value <= r.value)))
                    break;

                case "MOE":
                    this.push(lr((l, r) => node.Node.newNumber(l.value >= r.value)))
                    break;
             
                case "EQU":
                    this.push(lr((l, r) => node.Node.newNumber(l.value === r.value)))
                    break;

                case "NEQ":
                    this.push(lr((l, r) => node.Node.newNumber(l.value !== r.value)))
                    break;      

                case "ADD":
                    this.push(lr((l, r) => typeof (l.value + r.value) == "string" ?  node.Node.newString(l.value + r.value) : node.Node.newNumber(l.value + r.value)))
                    break;

                case "SUB":
                    this.push(lr((l, r) => node.Node.newNumber(l.value - r.value)))
                    break;

                case "MUL":
                    this.push(lr((l, r) => node.Node.newNumber(l.value * r.value)))
                    break;

                case "DIV":
                    this.push(lr((l, r) => node.Node.newNumber(l.value / r.value)))
                    break;
                default:
                    throw new Error("Invalid opcode "+this.prog[this.ip][0])
                    break;
                }

            this.ip += 1;
        }

        if (this.stack.length > 1)
            console.warn("STACK IS NOT CLEAR!!", this.stack)

        return this.pop()
    }

    static dump(p)
    {
        return node.Node.dump(p)
    }
}

module.exports.Env = Env
module.exports.Runtime = Runtime