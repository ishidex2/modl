const ops = {
    '||': 'OR',
    '&&': 'AND',
    '<': 'LES',
    '>': 'MOR',
    '<=': 'LOE',
    '>=': 'MOE',
    '==': 'EQU',
    '!=': 'NEQ',
    '+': 'ADD',
    '-': 'SUB',
    '*': 'MUL',
    '/': 'DIV'
}

let node = require("./node")

class Decomposer
{
    

    decompose(prog)
    {
        this.res = []
        this.idMode = "GET"
        this.invalidateCall = false
        this.rootProg = true
        this.discardEnv = false
        this.isCall = false
        this._decompose(prog)
        return this.res
    }

    _decompose(ast)
    {
        if (ast.type == "BINARY")
        {
            this._decompose(ast.left)
            this._decompose(ast.right)

            this.res.push([ops[ast.operator]])
        }
        if (ast.type == "UNARY")
        {
            this._decompose(ast.right)
            if (ast.operator === '-')
                this.res.push(["NEG"]);
            else if (ast.operator === '!')
                this.res.push(["NOT"]);
            else if (ast.operator === '#')
                this.res.push(["LEN"]);
        }
        else if (ast.type == "STORE")
        {
            this._decompose(ast.right)
            this.idMode = "SET"
            this._decompose(ast.left)
            this.idMode = "GET"

        }
        else if (ast.type == "NUMBER")
        {
            if (this.idMode == "SET")
            {
                throw new Error("Attempt to assign to non-identifier lvalue")
            }
            this.res.push(["PUSH", node.Node.newNumber(parseFloat(ast.label))])
        }
        else if (ast.type == "STRING")
        {
            if (this.idMode == "SET")
            {
                throw new Error("Attempt to assign to non-identifier lvalue")
            }
            this.res.push(["PUSH", node.Node.newString(ast.label)])
        }
        else if (ast.type == "IDENTIFIER")
        {
            if (this.idMode == "GET")
                this.res.push(["LOAD", ast.label])
            else if (this.idMode == "SET")
            {
                this.res.push(["STORE", ast.label])
            }
        }
        else if (ast.type == "CALL")
        {
            if (this.invalidateCall || this.idMode == "SET") 
            {
                throw new Error("Invalid lvalue assignment")
            }
            this.res.push(["CALLCNT", ast.args.length])
            for (let i = ast.args.length-1; i >= 0; i--)
            {   
                this._decompose(ast.args[i])
            }
            this.isCall = true;
            this._decompose(ast.func)
            this.res.push(["CALL"])
            this.isCall = false;
        }
        else if (ast.type == "PROG")
        {
            let rp = this.rootProg

            if (this.rootProg) {
                this.rootProg = false;
            }
            if (!rp && !this.discardEnv)
                this.res.push(["ENVPSH"])

            for (let i = 0; i < ast.prog.length; i++)
            {
                this._decompose(ast.prog[i])
                if (i < ast.prog.length-1)
                    this.res.push(["POP"])
            }
            if (!rp && !this.discardEnv)
                this.res.push(["ENVPOP"])

        }
        else if (ast.type == "IF")
        {
            let endv = []
            this._decompose(ast.cond)
            this.res.push(endv)
            this._decompose(ast.body)
            endv.push("JIFN")
            endv.push(this.res.length+1)
            let elseEnd = []
            this.res.push(elseEnd)
            if (ast.elseexpr)
            {
                this._decompose(ast.elseexpr)
                this.res.push(["JMP", this.res.length+2])
            }
            elseEnd.push("JMP")
            this.res.push(["PUSH", node.Node.newNil()])
            elseEnd.push(this.res.length)
        }
        else if (ast.type == "WHILE")
        {
            let endv = []
            this.res.push(["PUSH", node.Node.newTable({}, 0)])

            this.res.push(["JMP", this.res.length+2])
            let s = this.res.length;

            this.res.push(["TBLPSHR"])


            this._decompose(ast.cond)
            this.res.push(endv)
            this._decompose(ast.body)
            this.res.push(["JMP", s])
            endv.push("JIFN");
            endv.push(this.res.length)

        }
        else if (ast.type == "TABLE")
        {
            for (let i = 0; i < ast.tbl.length; i++)
            {
                this._decompose(ast.tbl[i].value)
                this.res.push(["PUSH", node.Node.newString(ast.tbl[i].key.label+"")])
            }
            this.res.push(["NEWTBL", ast.lastIndex])

            for (let i = 0; i < ast.tbl.length; i++)
            {
                this.res.push(["TBLSETI"])
            }
        }
        else if (ast.type == "ACCESSOR")
        {
            if (this.idMode == "GET")
            {
                if (ast.passSelf && !this.isCall) 
                {
                    throw new Error("Recieved colon accessor selector without intention to call it");
                }
                else if (ast.passSelf)
                {
                    this._decompose(ast.left)
                }
            }
            let remMod = this.idMode
            this.idMode = "GET"

            if (!ast.pushv)
                this._decompose(ast.selector)
            this.invalidateCall = true
            this._decompose(ast.left)
            this.invalidateCall = false
            this.idMode = remMod
            if (this.idMode == "SET")
            {
                if (ast.pushv) 
                {
                    this.res.push(["TBLPSH"])  
                }
                else this.res.push(["TBLSET"])
            }
            else 
            {
                if (ast.pushv) 
                {
                    throw new Error("Recieved empty bracket accessor selector without intention to store it");
                }
                
                this.res.push(["TBLGET"])
            }
        }
        else if (ast.type == "FUNC")
        {
            this.discardEnv = false;
            let jend = ["JMP"]
            this.res.push(jend)
            let fnstart = this.res.length
            this.res.push(["ENVPSH"])
            for (let i = 0; i < ast.args.length; i++)
            {
                this.res.push(["STORE", ast.args[i].label])
                this.res.push(["POP"])
            }
            
            this.discardEnv = true;
            this._decompose(ast.body)
            this.discardEnv = false;
            this.res.push(["ENVPOP"])

            this.res.push(["RET"])
            this.res.push(["PUSH", node.Node.newFun(fnstart, false, ast.args.length)])
            let rend = this.res.length-1
            jend.push(rend)
        }
    }

    static fancy(code)
    {
        let r = ''
        for (let i = 0; i < code.length; i++)
        {
            r += `${i}:` + code[i][0] + " " + code[i].slice(1).map(e => node.Node.dump(e)).join(", ") + "\n"
        }
        return r
    }
}

module.exports = Decomposer