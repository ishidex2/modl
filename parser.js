let debug = require("./debug");


class Parser
{
    yield(type = null)
    {
        if (this.idx + 1 > this.tokens.length)
        {
            throw new Error(`Unexpected EOF`)
        }
        if (type && this.tokens[this.idx].type !== type)
        {
            throw new Error(`Unexpected type ${this.tokens[this.idx].type}`)
        }
        return this.tokens[this.idx++]
    }

    maybe(type)
    {
        let a = this.peek();
        return a && a.type == type ? a : null
    }

    maybeLabel(label)
    {
        let a = this.peek();
        return a && a.label == label ? a : null
    }

    peek()
    {
        return this.tokens[this.idx]
    }

    skip(label = null)
    {
        if (!this.tokens[this.idx])
        {
            throw new Error(`Unexpected EOF`)

        }
        if (label !== null && this.tokens[this.idx].label !== label)
        {
            // console.log("ERR", JSON.stringify(this.tokens.slice(this.idx)))
            throw new Error(`Unexpected token ${this.tokens[this.idx].label}`)
        }
        this.idx += 1
    }

    skipType(type)
    {
        if (!this.tokens[this.idx])
        {
            throw new Error(`Unexpected EOF`)

        }
        if (this.tokens[this.idx].type !== type)
        {
            // console.log("ERR", JSON.stringify(this.tokens.slice(this.idx)))
            throw new Error(`Unexpected token ${this.tokens[this.idx].type}`)
        }
        this.idx += 1
    }

    parse(tokens)
    {
        debug.begin('parse');

        this.callCnt = 0;
        this.tokens = tokens
        this.idx = 0
        this.skipParen = false;
        this.isin = "none"

        let p = this.parseProg();
        // console.log(this.callCnt);

        debug.end('parse');
        return p;
    }

    maybeCall(fn)
    {
        this.callCnt += 1;
        fn = fn()
        if (this.skipParen) return fn;
        let isParen = this.maybeLabel("(")
        if (isParen)
        {
            this.skip()
            let args = []

            let first = false;
            while (this.idx < this.tokens.length)
            {
                if (this.maybeLabel(")")) break;
                if (!first) first = true;
                else this.skip(",");
                if (this.maybeLabel(")")) break;
                args.push(this.parseExpression())
            }

            this.skip(")");

            return this.maybeCall(() => {return {
                type: "CALL",
                func: fn,
                args: args
            }})
        }
        return fn;
    }

    maybeAccess(acc)
    {
        this.callCnt += 1;

        acc = this.maybeCall(() => acc());
        let l = this.maybeLabel("[")

        if (l)
        {
            let pushv = false
            let accessor = null
            this.skip("[")
            if (this.maybeLabel("]"))
            {
                pushv = true
            }
            else accessor = this.parseExpression()
            this.skip("]")

            return this.maybeAccess(() => {return {
                type: "ACCESSOR",
                selector: accessor,
                pushv: pushv,
                left: acc
            }})
        }

        l = this.maybeLabel(".")
        let _self = this.maybeLabel("::")


        if (l || _self)
        {
            this.skip()
            let accessor = this.maybe("IDENTIFIER")
            this.skipType("IDENTIFIER")

            accessor.type = "STRING"

            return this.maybeAccess(() => {return {
                type: "ACCESSOR",
                passSelf: _self ? true : false,
                selector: accessor,
                left: acc
            }})
        }
        
        return acc;
    }
  
    parseProg()
    {
        this.callCnt += 1;
        var prog = [];

        while (this.idx < this.tokens.length)
        {
            if (this.maybeLabel("}")) break;
            this.state = "FLVL"
            prog.push(this.parseAtomic())
            if (this.maybeLabel("}")) break;
            if (!(this.tokens[this.idx+1] ? this.tokens[this.idx+1].label === "}" : true)) this.skip(";")
            else if (this.maybeLabel(";")) this.skip(";")
        }
        return {type: "PROG", prog: prog}
    }

    parseTable()
    {
        this.callCnt += 1;

        this.isin = "table";
        var tbl = [];

        let lastIndex = 0;

        while (this.idx < this.tokens.length)
        {
            if (this.maybeLabel("]")) break;
            let expr = this.parseExpression();
            if (this.maybeLabel(":"))
            {
                this.skip(":")
                tbl.push({key: expr, value: this.parseExpression()})
            }
            else 
            {
                tbl.push({key: {type: "NUMBER", label: lastIndex}, value: expr})
                lastIndex += 1
            }
            if (this.maybeLabel("]")) break;
            this.skip(",")
        }
        this.isin = "none";
        return {type: "TABLE", lastIndex: lastIndex, tbl: tbl} 
    }

    parseFunc()
    {
        this.callCnt += 1;

        let anon = false
        let name = null
        let first = false
        let args = []

        this.skipParen = true;
        if (this.peek().label == "(")
        {
            anon = true
        } else name = this.parseExpression();
        this.skipParen = false;

        this.skip("(");

        while (this.idx < this.tokens.length)
        {
            if (this.maybeLabel(")")) break;
            if (!first) first = true;
            else this.skip(",");
            if (this.maybeLabel(")")) break;
            args.push(this.yield("IDENTIFIER"));
        }

        this.skip(")")

        if (this.maybeLabel(":")) this.skip(":")
        
        let body = this.parseExpression();

        if (!anon)
            return {
                type: "STORE",
                operator: "=",
                left: name,
                right: {
                    type: "FUNC", 
                    args: args,
                    body: body
                }
            }
        else return {
                type: "FUNC", 
                args: args,
                body: body
            }
    }

    parseIf()
    {
        this.callCnt += 1;

        let cond = this.parseExpression()
        if(this.maybeLabel(":")) this.skip(":")

        let body = this.parseExpression()

        let _else = this.maybeLabel("else");
        let elsexpr = null
        if (_else)
        {
            this.skip("else")
            if(this.maybeLabel(":")) this.skip(":")
            elsexpr = this.parseExpression()
        }

        return {type: "IF", cond: cond, body: body, elseexpr: elsexpr}
    }

    parseWhile()
    {
        this.callCnt += 1;

        this.isin = "while"
        let cond = this.parseExpression()
        if(this.maybeLabel(":")) this.skip(":")

        let body = this.parseExpression()
        this.isin = "none"
        return {type: "WHILE", cond: cond, body: body}
    }

    parseUnary(op)
    {
        console.log(this.tokens.slice(this.idx))
        if (!(["-", "!", "#"].includes(op.label))) throw new Error("Invalid unary operator");
        return {
            type: "UNARY",
            operator: op.label,
            right: this.parseAtomic()
        }
    }

    parseAtomic()
    {        
        this.callCnt += 1;

        return this.maybeAccess(() => {
            if (this.state === "FLVL")
            {
                this.state = "NO"
                return this.parseExpression()
            }

            let token = this.yield();


            if (token.label == "(" && !this.skipParen)
            {
                let expr = this.parseExpression()
                this.skip(")");
                return expr;
            }

            if (this.isin == "while")
            {
                if (token.label == "break")
                {
                    return {type: "BREAK", label: "break"}
                }
            }

            if (token.label == "if")
            {
                return this.parseIf()
            }

            if (token.label == "func")
            {
                return this.parseFunc()
            }

            if (token.label == "while")
            {
                return this.parseWhile()
            }

            if (token.label == "{")
            {
                let prog = this.parseProg()
                this.skip("}");
                return prog;
            }

            if (token.label == "[")
            {
                let prog = this.parseTable()
                this.skip("]");
                return prog;
            }
        
            if (token.type == "NUMBER")
            {
                return token;
            }

            if (token.type == "BOOL")
            {
                if (token.label == "true") token.label = "1"
                else token.label = "0"
                token.type = "NUMBER"
                return token
            }


            if (token.type == "IDENTIFIER")
            {
                return token
            }

            if (token.type == "STRING")
            {
                token.label = token.label.slice(1, -1)
                return token;
            }

            if (token.type == "OPERATOR")
            {
                return this.parseUnary(token);
            }

            // console.log(this.tokens.slice(this.idx))
            throw new Error(`Unexpected token ${token.label}`)
        })
    }

    parseExpression()
    {
        this.callCnt += 1;

        return this.maybeAccess(() => this.parseBinary(this.parseAtomic(), 0))
    }

    parseBinary(left, priority)
    {
        this.callCnt += 1;

        let op = this.maybe("OPERATOR")
        
        if (op)
        {
            let thisPriority = Parser.priority[op.label]
            if (thisPriority > priority)
            {
                this.skip()
                return this.parseBinary({
                    type: op.label == "=" ? "STORE" : "BINARY",
                    operator: op.label,
                    left: left,
                    right: this.parseBinary(this.parseAtomic(), thisPriority)
                }, priority)
            }
        }

        return left;
    }
}

Parser.priority = {
    '=': 1,
    '||': 2,
    '&&': 3,
    '<': 10,
    '>': 10,
    '<=': 10,
    '>=': 10,
    '==': 10,
    '!=': 10,
    '+': 20,
    '-': 20,
    '*': 30,
    '/': 30
}

module.exports = Parser
