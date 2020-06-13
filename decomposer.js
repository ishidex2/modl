let Encoder = require("./encoder.js");
let Debug = require("./debug.js");

class Decomposer
{
    start(ast) 
    {
        this.result = [];
        this.labels = [];
        this.lastByte = 0;
        this.shouldReturnValue = true;
        Debug.begin("decomposer");
        this.decompose(ast, 0);
        Debug.end("decomposer");
        Debug.dumpTimers();

        this.emitInstruction(Decomposer.instruction.RET);
        return new Uint8Array(this.result.flat());
    }

    decompose(ast, depth, expect = [])
    {
        if (depth === undefined) {
            throw new Error("Invalid depth")
        }
        // TODO: Make "Register Range Used" Array, instead of hardcoding 12
        let _depth;
        if (depth > 12 || ast.type == "CALL")
        {

            for (let i = 0; i < depth; i++)
            {
                this.emitInstruction(Decomposer.instruction.PUSH, {register: i})
            }
            _depth = depth;
            depth = 0;  
        }
        // Prevent nesting
        
        if (expect.length > 0)
        {
            if (!(expect.includes(type)))
            {
                throw new Error("Expected type(s) "+JSON.stringify(expect))
            }
        }
        switch (ast.type)
        {
            case "PROG":
                this.emitProg(ast, depth)
                break;
            case "NUMBER":
                this.emitNumber(ast, depth);
                break;
            case "UNARY":
                this.emitUnary(ast, depth);
                break;
            case "STRING":
                this.emitString(ast, depth);
                break;
            case "IDENTIFIER":
                this.emitIdentifier(ast, depth);
                break;
            case "NIL":
                this.emitInstruction(Decomposer.instruction.LOADC, {register: depth, data: null});
                break;
            case "ACCESSOR":
                this.emitAccessor(ast, depth);
                break;
            case "TABLE":
                this.emitTable(ast, depth);
                break;
            case "FUNC":
                this.emitFunc(ast, depth);
                break;
            case "CALL":
                this.emitCall(ast, depth);
                break;
            case "BINARY":
                this.emitBinary(ast, depth); 
                break;
            case "IF":
                this.emitIf(ast, depth);
                break;
            case "WHILE":
                this.emitWhile(ast, depth);
                break;
            case "STORE":
                this.emitStore(ast, depth);
                break;
            default:
                throw "Invalid parser branch";

        }
        // Resume
        if (depth > 12 || ast.type == "CALL")
        {

            depth = _depth;

            // Move value to expected, depth value
            this.emitInstruction(Decomposer.instruction.MOV, {source: 0, dest: depth})
            
            for (let i = depth-1; i >= 0; i--)
            {
                this.emitInstruction(Decomposer.instruction.POP, {register: i})
            }
        }
        
    }

    emitTable(ast, depth)
    {
        Debug.begin("emitTable");
        this.emitInstruction(Decomposer.instruction.LOADC, {register: depth, data: []})


        ast.tbl.forEach(e => {
            if (e.key.type === "IDENTIFIER")
                this.emitInstruction(Decomposer.instruction.LOADC, {register: depth + 1, data: e.key.label})
            else
                this.decompose(e.key, depth + 1);

            this.decompose(e.value, depth + 2);

            this.emitInstruction(Decomposer.instruction.TBLSETR, {table: depth, name: depth+1, value: depth+2});
        });
        Debug.end("emitTable");

    }

    emitCall(ast, depth)
    {
        Debug.begin("emitCall");
        this.shouldReturnValue = true;
        if (ast.func.type !== "ACCESSOR" && ast.func.type !== "IDENTIFIER")
        {
            throw new Error("Lvalue must be an identifier or accessor");
        }
        ast.args.reverse().forEach(e => {
            this.decompose(e, depth);
            this.emitInstruction(Decomposer.instruction.PUSH, {register: depth});
        })
        this.emitAccessor(ast.func, depth, false, true);
        
        this.emitInstruction(Decomposer.instruction.CALLR, {register: depth});
        this.shouldReturnValue = false;
        Debug.end("emitTable");
    }
    
    /** A problem with "depth" strategy, since every time we "decompose" call we have to push all our registers */
    emitFunc(ast, depth, passSelf = false)
    {
        Debug.begin("emitFunc");
        this.emitInstruction(Decomposer.instruction.JMP);
        let jumpOver = this.createLabel();
        let fnStart = this.lastByte;
        if (passSelf)
        {
            this.emitInstruction(Decomposer.instruction.POP, {register: 0});
            this.emitInstruction(Decomposer.instruction.ENVSETC, {value: 0, name: "self"});
        }
        ast.args.forEach(e => {
            if (e.type !== "ACCESSOR" && e.type !== "IDENTIFIER")
            {
                throw new Error("Function parameter must be an identifier or accessor");
            }
            this.emitInstruction(Decomposer.instruction.POP, {register: 0});
            this.emitInstruction(Decomposer.instruction.ENVSETC, {value: 0, name: e.label});
        })
        this.decompose(ast.body, 0); // We don't need to change depth in body, for obvious reasons
        this.emitInstruction(Decomposer.instruction.RET);
        this.resolveLabel(jumpOver);
        this.emitInstruction(Decomposer.instruction.LOADFUN, {register: depth, offset: fnStart-this.lastByte});
        Debug.end("emitFunc");
    }

    emitWhile(ast, depth)
    {
        Debug.begin("emitWhile");

        if (this.shouldReturnValue)
        {
            this.emitInstruction(Decomposer.instruction.LOADC, {register: depth+1, data: []})
            this.emitInstruction(Decomposer.instruction.JMP);
        }
        let pushSkipLabel = this.createLabel();
        let backLabel = this.createLabel();
        if (this.shouldReturnValue)
        {
            this.emitInstruction(Decomposer.instruction.TBLPUSH, {table: depth+1, value: depth+2});
            this.resolveLabel(pushSkipLabel);
        }
        this.decompose(ast.cond, depth+2);
        
        this.emitInstruction(Decomposer.instruction.JCF, {register: depth+2});
        let quitLabel = this.createLabel();
        this.decompose(ast.body, depth+2);
        this.emitInstruction(Decomposer.instruction.JMP);
        this.resolveLabel(backLabel, true);
        this.resolveLabel(quitLabel);
        this.emitInstruction(Decomposer.instruction.MOV, {source: depth+1, dest: depth});
        Debug.end("emitWhile");

    }

    static parseNumber(num)
    {
        num += "";
        if (num.search("\\.") !== -1)
        {
            return parseFloat(num)
        }
        else if (num[1] == "b")
        {
            return parseInt(num.slice(2), 2)
        }
        return parseInt(num)
    }

    emitUnary(ast, depth)
    {
        Debug.begin("emitUnary");

        this.decompose(ast.right, depth);
        switch (ast.operator)
        {
            case "#":
                this.emitInstruction(Decomposer.instruction.LEN, {register: depth});
                break;
            case "~":
                this.emitInstruction(Decomposer.instruction.INV, {register: depth});
                break;
            case "!":
                this.emitInstruction(Decomposer.instruction.NOT, {register: depth});
                break;
            case "-":
                this.emitInstruction(Decomposer.instruction.NEG, {register: depth});
                break;
            case "return":
                this.emitInstruction(Decomposer.instruction.RET, {register: depth});
                break;

            default: throw "Unknown unary"
        }
        Debug.end("emitUnary");

    }

    emitIdentifier(ast, depth)
    {
        Debug.begin("emitIdentifier");

        this.emitInstruction(Decomposer.instruction.ENVGETC, {register: depth, name: ast.label})
        Debug.end("emitIdentifier");

    }

    emitAccessor(ast, depth, store = false, call = false)
    {
        Debug.begin("emitAccessor");

        if (ast.type == "IDENTIFIER")
        {
            this.emitIdentifier(ast, depth)
            return;
        }

        this.decompose(ast.left, depth);
        if (ast.passSelf && call)
            this.emitInstruction(Decomposer.instruction.PUSH, {register: depth});
        if (!ast.pushv)
            this.decompose(ast.selector, depth+1); 

        if (store && !ast.pushv)
            this.emitInstruction(Decomposer.instruction.TBLSETR, {table: depth, name: depth+1, value: depth-1});
        else if (ast.pushv)
            this.emitInstruction(Decomposer.instruction.TBLPUSH, {value: depth-1, table: depth});
        else 
            this.emitInstruction(Decomposer.instruction.TBLGETR, {table: depth, name: depth+1});
        
        Debug.end("emitAccessor");
    }

    emitStore(ast, depth)
    {
        Debug.begin("emitStore");

        this.shouldReturnValue = true;
        if (ast.left.type !== "ACCESSOR" && ast.left.type !== "IDENTIFIER")
        {
            throw new Error("Lvalue must be an identifier or accessor");
        }

        // func a::b()
        // shall pass self as a parameter of function, containing `a`
        if (ast.right.type === "FUNC" && ast.left.type === "ACCESSOR") {
            this.emitFunc(ast.right, depth, ast.left.passSelf ? true : false)}
        else
            this.decompose(ast.right, depth);
        if (ast.left.type === "ACCESSOR")
            this.emitAccessor(ast.left, depth+1, true);
        else
            this.emitInstruction(Decomposer.instruction.ENVSETC, {value: depth, name: ast.left.label});
        this.shouldReturnValue = false;
        Debug.end("emitStore");

    }

    emitIf(ast, depth)
    {
        Debug.begin("emitIf");

        this.decompose(ast.cond, depth);
        this.emitInstruction(Decomposer.instruction.JCF, {register: depth});
        let lbl = this.createLabel();
        this.decompose(ast.body, depth);    
        let quitlbl;

        this.emitInstruction(Decomposer.instruction.JMP);
        quitlbl = this.createLabel()

        this.resolveLabel(lbl);
        if (ast.elseexpr)
            this.decompose(ast.elseexpr, depth);
        else
            this.emitInstruction(Decomposer.instruction.LOADC, {register: depth, data: null})

        this.resolveLabel(quitlbl);
        Debug.end("emitIf");

    }

    emitBinary(ast, depth)
    {
        Debug.begin("emitBinary");

        let skipSwitch = false;
        let skipLabel;
        
        this.decompose(ast.left, depth);

        if (ast.operator == "&&")
        {
            skipSwitch = true;
            this.emitInstruction(Decomposer.instruction.JCF, {register: depth})
            skipLabel = this.createLabel();
        }



        this.decompose(ast.right, depth+(!skipSwitch));

        // Resolve skip label, For operations like && which only run second check, if previous was valid
        if (skipLabel)
        {
            this.resolveLabel(skipLabel);
        }
        if (!skipSwitch)
        switch (ast.operator)
        {
            case "||":
            case "|":
                this.emitInstruction(Decomposer.instruction.OR, {rl: depth+0, rr: depth+1})
                break;
            case "^":
                this.emitInstruction(Decomposer.instruction.XOR, {rl: depth+0, rr: depth+1})
                break;
            case "&":
                this.emitInstruction(Decomposer.instruction.AND, {rl: depth+0, rr: depth+1})
                break;    
            case "==":
                this.emitInstruction(Decomposer.instruction.CMPEQ, {rl: depth+0, rr: depth+1})
                break;
            case "!=":
                this.emitInstruction(Decomposer.instruction.CMPNEQ, {rl: depth+0, rr: depth+1})
                break;
            case "<":
                this.emitInstruction(Decomposer.instruction.CMPLT, {rl: depth+0, rr: depth+1})
                break;
            case ">":
                this.emitInstruction(Decomposer.instruction.CMPGT, {rl: depth+0, rr: depth+1})
                break;
            case "<=":
                this.emitInstruction(Decomposer.instruction.CMPLE, {rl: depth+0, rr: depth+1})
                break;
            case ">=":
                this.emitInstruction(Decomposer.instruction.CMPGE, {rl: depth+0, rr: depth+1})
                break;
            case "<<":
                this.emitInstruction(Decomposer.instruction.ROL, {rl: depth+0, rr: depth+1})
                break;
            case ">>":
                this.emitInstruction(Decomposer.instruction.ROR, {rl: depth+0, rr: depth+1})
                break;
            case "+":
                this.emitInstruction(Decomposer.instruction.ADD, {rl: depth+0, rr: depth+1})
                break;
            case "-":
                this.emitInstruction(Decomposer.instruction.SUB, {rl: depth+0, rr: depth+1})
                break;
            case "*":
                this.emitInstruction(Decomposer.instruction.MUL, {rl: depth+0, rr: depth+1})
                break;
            case "/":
                this.emitInstruction(Decomposer.instruction.DIV, {rl: depth+0, rr: depth+1})
                break;
            case "~/":
                this.emitInstruction(Decomposer.instruction.IDIV, {rl: depth+0, rr: depth+1})
                break;
            case "%":
                this.emitInstruction(Decomposer.instruction.MOD, {rl: depth+0, rr: depth+1})
                break;





            default: throw "Invalid operator"
        }
        Debug.end("emitBinary");

    }

    emitNumber(ast, depth)
    {
        Debug.begin("emitNumber");

        this.emitInstruction(Decomposer.instruction.LOADC, {
            data: Decomposer.parseNumber(ast.label),
            register: depth
        });
        Debug.end("emitNumber");

    }
    
    emitString(ast, depth)
    {
        Debug.begin("emitString");

        this.emitInstruction(Decomposer.instruction.LOADC, {
            data: ast.label,
            register: depth
        });

        Debug.end("emitString");

    }
    
    emitProg(ast, depth)
    {
        Debug.begin("emitProg");

        // Remember this.shouldReturnValue sometimes prog values are not used at all, hence the optimization
        let rem = this.shouldReturnValue;
        this.shouldReturnValue = false;
        for (let i = 0; i < ast.prog.length; i++)
        {
            if (i === ast.prog.length-1)
            {
                this.shouldReturnValue = rem;
            }
            this.decompose(ast.prog[i], depth);
        }
        Debug.end("emitProg");

    }

    join(v)
    {
        this.result.push(v);
    }

    emitInstruction(instr, params)
    {
        this.instcnt = this.instcnt ? this.instcnt : 0;
        this.instcnt += 1;
        let dbgstr = this.instcnt+" "+this.lastByte.toString(16).padStart(4, "0")+": ";
        let res = []
        res.push(instr);
        switch (instr)
        {
            case Decomposer.instruction.LOADC:
                dbgstr += (`LOADC R${params.register} ${JSON.stringify(params.data)}`);
                res.push(params.register);
                res.push(this.encode(params.data));
                break;
            case Decomposer.instruction.MOV:
                dbgstr += (`MOV R${params.dest} R${params.source}`);
                res.push((params.dest << 4) | (params.source & 0x0F))
                break;
            case Decomposer.instruction.CALLR:
                dbgstr += (`CALLR R${params.register}`);
                res.push(params.register);
                break;
            case Decomposer.instruction.RET:
                dbgstr += (`RET`);
                break;
            case Decomposer.instruction.NOP:
                dbgstr += (`NOP`);
                break;
            case Decomposer.instruction.ROL:
                dbgstr += (`ROL R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.ROR:
                dbgstr += (`ROR R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.AND:
                dbgstr += (`AND R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.MOD:
                dbgstr += (`MOD R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.ADD:
                dbgstr += (`ADD R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.SUB:
                dbgstr += (`SUB R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.MUL:
                dbgstr += (`MUL R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.IDIV:
                dbgstr += (`IDIV R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.DIV:
                dbgstr += (`DIV R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.OR:
                dbgstr += (`OR R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.XOR:
                dbgstr += (`XOR R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.POP:
                dbgstr += (`POP R${params.register}`);
                res.push(params.register)
                break;
            case Decomposer.instruction.PUSH:
                dbgstr += (`PUSH R${params.register}`);
                res.push(params.register)
                break;
            case Decomposer.instruction.TBLPUSH:
                dbgstr += (`TBLPUSH R${params.table} R${params.value}`);
                res.push((params.table << 4) | (params.value & 0x0F))
                break;
            case Decomposer.instruction.JMP:
                dbgstr += (`JMP`);
                res.push([0, 0, 0, 0, 0, 0, 0, 0])
                break;
            case Decomposer.instruction.CMPEQ:
                dbgstr += (`CMPEQ R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.CMPNEQ:
                dbgstr += (`CMPNEQ R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.CMPGE:
                dbgstr += (`CMPGE R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.CMPLE:
                dbgstr += (`CMPLE R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.CMPGT:
                dbgstr += (`CMPGT R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.CMPLT:
                dbgstr += (`CMPLT R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.JCF: 
                dbgstr += (`JCF R${params.register}`);
                res.push(params.register);
                res.push([0, 0, 0, 0, 0, 0, 0, 0]) 
                break;
            case Decomposer.instruction.JCT: 
                dbgstr += (`JCT R${params.register}`);
                res.push(params.register);
                res.push([0, 0, 0, 0, 0, 0, 0, 0]) 
                break;
            case Decomposer.instruction.ENVGETC: 
                dbgstr += (`ENVGETC R${params.register} ${params.name}`);
                res.push(params.register);
                res.push(this.encode(params.name)) 
                break;
            case Decomposer.instruction.ENVSETC: 
                dbgstr += (`ENVSETC R${params.value} ${params.name}`);
                res.push(params.value);
                res.push(this.encode(params.name)) 
                break;
            case Decomposer.instruction.LOADFUN:
                dbgstr += (`LOADFUN R${params.register} ${params.offset}`);
                res.push(params.register);
                res.push(this.split64BitInteger(params.offset));
                break;
            case Decomposer.instruction.TBLGETR: 
                dbgstr += (`TBLGETR R${params.table} R${params.name}`);
                res.push((params.table << 4) | (params.name & 0x0F))
                break;
            case Decomposer.instruction.ENVUPKC: 
                dbgstr += (`ENVUPKC R${params.table} ${params.name}`);
                res.push((params.table & 0x0F))
                res.push(this.encode(params.name))
                break;
            case Decomposer.instruction.TBLSETR: 
                dbgstr += (`TBLSETR R${params.table} R${params.name} R${params.value}`);
                res.push((params.table << 4) | (params.name & 0x0F))
                res.push(params.value)
                break;
            case Decomposer.instruction.NOT: 
                dbgstr += (`NOT R${params.register}`);
                res.push(params.register);
                break;
            case Decomposer.instruction.INV: 
                dbgstr += (`INV R${params.register}`);
                res.push(params.register);
                break;
            case Decomposer.instruction.LEN: 
                dbgstr += (`LEN R${params.register}`);
                res.push(params.register);
                break;
            case Decomposer.instruction.NEG: 
                dbgstr += (`NEG R${params.register}`);
                res.push(params.register);
                break;

            default: throw new Error("Invalid opcode")
        }

        Debug.event("INSTRUCTION", dbgstr);
        res = res.flat();
        this.lastByte += res.length
        this.join(res);
    }

    encode(val)
    {
        return [...Encoder.encode(val)]
    }

    constructor()
    {
    }

    createPastLabel()
    {
           
    }


    createLabel()
    {
        return [this.lastByte, this.result.length-1];
    }

    split64BitInteger(number)
    {
        let r = BigInt(number);
        let res = []
        for (let i = 7; i >= 0; i--)
        {
            res.push(parseFloat((r >> BigInt(i*8)) & 0xffn));
        }
        return res;
    }

    resolveLabel(addr, past = false)
    {
        let r;

        if (!past)
        {
            r = this.lastByte-addr[0];
            addr = addr[1]
        } 
        else 
        {
            r = addr[0]-this.lastByte;
            addr = this.result.length-1
        }
        let rl = this.result[addr].length;

        r += rl;
        r = BigInt(r);

    
        for (let i = 0; i < 8; i++)
        {
            this.result[addr][rl-(i+1)] = parseFloat((r >> BigInt(i*8)) & 0xffn);
        }
    }


    emitByte(b)
    {
        this.result.push(b);
    }
}


Decomposer.instruction = {
    NOP: 0x0,
    RET: 0x01,
    MOV: 0x02,
    LOADC: 0x04,
    TBLGETR: 0x05,
    CALLR: 0x09,
    LOADFUN: 0x0C,
    ROL: 0x0D,
    ROR: 0x0E,
    IDIV: 0x0F,
    ADD: 0x10,
    SUB: 0x11,
    MUL: 0x12,
    DIV: 0x13,
    MOD: 0x14,
    AND: 0x15,
    OR: 0x16,
    XOR: 0x17,
    JMP: 0x1F,
    CMPEQ: 0x20,
    CMPNEQ: 0x21,
    CMPLT: 0x22,
    CMPGT: 0x24,
    CMPLE: 0x26,
    CMPGE: 0x28,
    JCF: 0x30,
    JCT: 0x31,
    POP: 0x40,
    PUSH: 0x41,
    TBLPUSH: 0x42,
    TBLSETR: 0x43,
    ENVGETC: 0x46,
    ENVSETC: 0x48,
    ENVUPKC: 0x4A,
    NOT: 0x50,
    INV: 0x51,
    LEN: 0x52,
    NEG: 0x53,
}

module.exports = Decomposer
