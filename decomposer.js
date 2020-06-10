let Encoder = require("./encoder.js");
let Debug = require("./debug.js");

class Decomposer
{
    start(ast) 
    {
        this.result = [];
        this.labels = [];
        this.lastByte = 0;
        Debug.begin("decomposer");
        this.decompose(ast);
        Debug.end("decomposer");
        Debug.dumpTimers();

        this.emitInstruction(Decomposer.instruction.RET);
        return new Uint8Array(this.result.flat());
    }

    decompose(ast, depth = 0, expect = [])
    {
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
                this.emitProg(ast)
                break;
            case "NUMBER":
                this.emitNumber(ast, depth);
                break;
            case "STRING":
                this.emitString(ast, depth);
                break;
            case "IDENTIFIER":
                this.emitIdentifier(ast, depth);
                break;
            case "NIL":
                this.emitInstruction(Decomposer.instruction.LOADC, {register: 0, data: null});
                break;
            case "ACCESSOR":
                this.emitAccessor(ast);
                break;
            case "TABLE":
                this.emitTable(ast);
                break;
            case "FUNC":
                this.emitFunc(ast);
                break;
            case "CALL":
                this.emitCall(ast);
                break;
            case "BINARY":
                this.emitBinary(ast); 
                break;
            case "IF":
                this.emitIf(ast);
                break;
            case "WHILE":
                this.emitWhile(ast);
                break;
            case "STORE":
                this.emitStore(ast);
                break;
            default:
                throw "Invalid parser branch";

        }

    }

    emitTable(ast)
    {

        this.emitInstruction(Decomposer.instruction.LOADC, {register: 2, data: []})
        ast.tbl.forEach(e => {
            this.decompose(e.key, 1);
            this.decompose(e.value);
            this.emitInstruction(Decomposer.instruction.TBLSETR, {table: 2, name: 1, value: 0});
        })

        this.emitInstruction(Decomposer.instruction.MOV, {source: 2, dest: 0});
    }

    emitCall(ast)
    {
        if (ast.func.type !== "ACCESSOR" && ast.func.type !== "IDENTIFIER")
        {
            throw new Error("Lvalue must be an identifier or accessor");
        }
        ast.args.reverse().forEach(e => {
            this.decompose(e);
            this.emitInstruction(Decomposer.instruction.PUSH, {register: 0});
        })

        this.emitAccessor(ast.func);

        this.emitInstruction(Decomposer.instruction.CALLR, {register: 0});
    }
    
    
    emitFunc(ast)
    {
        this.emitInstruction(Decomposer.instruction.JMP);
        let jumpOver = this.createLabel();
        let fnStart = this.lastByte;
        ast.args.forEach(e => {
            if (e.type !== "ACCESSOR" && e.type !== "IDENTIFIER")
            {
                throw new Error("Function parameter must be an identifier or accessor");
            }
            this.emitInstruction(Decomposer.instruction.POP, {register: 0});
            this.emitInstruction(Decomposer.instruction.ENVSETC, {value: 0, name: e.label});
        })
        this.decompose(ast.body);
        this.emitInstruction(Decomposer.instruction.RET);
        this.resolveLabel(jumpOver);
        this.emitInstruction(Decomposer.instruction.LOADFUN, {register: 0, offset: fnStart-this.lastByte});
    }

    emitWhile(ast)
    {
        this.emitInstruction(Decomposer.instruction.LOADC, {register: 0, data: []})
        this.emitInstruction(Decomposer.instruction.PUSH, {register: 0})
        this.emitInstruction(Decomposer.instruction.JMP);
        let pushSkipLabel = this.createLabel();
        let backLabel = this.createLabel();
        this.emitInstruction(Decomposer.instruction.MOVE, {source: 1, dest: 0})
        this.emitInstruction(Decomposer.instruction.TBLPUSH, {table: 0, value: 1});
        this.emitInstruction(Decomposer.instruction.PUSH, {register: 0});

        this.resolveLabel(pushSkipLabel)

        this.decompose(ast.cond);
        this.emitInstruction(Decomposer.instruction.JCF, {register: 0});
        let quitLabel = this.createLabel();
        this.decompose(ast.body);
        this.emitInstruction(Decomposer.instruction.JMP);
        this.resolveLabel(backLabel, true);
        this.resolveLabel(quitLabel);
    }

    emitIdentifier(ast, reg)
    {
        this.emitInstruction(Decomposer.instruction.ENVGETC, {register: reg, name: ast.label})
    }
    emitAccessor(ast, store = false, call = false)
    {
        if (ast.type == "IDENTIFIER")
        {
            this.emitIdentifier(ast, 0)
            return;
        }

        this.emitInstruction(Decomposer.instruction.PUSH, {register: 0});

        this.decompose(ast.left);

        
        if (!ast.pushv)
            this.emitString(ast.selector, 1);

        this.emitInstruction(Decomposer.instruction.POP, {register: 2});

        if (store && !ast.pushv)
            this.emitInstruction(Decomposer.instruction.TBLSETR, {table: 0, name: 1, value: 2});
        else if (ast.pushv)
        {
            this.emitInstruction(Decomposer.instruction.ENVGETC, {register: 1, name: ast.left.label});
            this.emitInstruction(Decomposer.instruction.TBLPUSH, {value: 2, table: 1});
        }
        else 
            this.emitInstruction(Decomposer.instruction.TBLGETR, {table: 0, name: 1});
         
    }

    emitStore(ast)
    {
        if (ast.left.type !== "ACCESSOR" && ast.left.type !== "IDENTIFIER")
        {
            throw new Error("Lvalue must be an identifier or accessor");
        }
        this.decompose(ast.right);
        if (ast.left.type === "ACCESSOR")
            this.emitAccessor(ast.left, true);
        else
            this.emitInstruction(Decomposer.instruction.ENVSETC, {value: 0, name: ast.left.label});
    }

    emitIf(ast)
    {
        this.decompose(ast.cond);
        this.emitInstruction(Decomposer.instruction.JCF, {register: 0});
        let lbl = this.createLabel();
        this.decompose(ast.body);    
        let quitlbl;

        this.emitInstruction(Decomposer.instruction.JMP);
        quitlbl = this.createLabel()

        this.resolveLabel(lbl);
        if (ast.elseexpr)
            this.decompose(ast.elseexpr);
        else
            this.emitInstruction(Decomposer.instruction.LOADC, {register: 0, data: null})

        this.resolveLabel(quitlbl);
    }

    emitDeepBranch(ast, depth)
    {
        let canUseExtraRegisters = depth < 5;
        depth = depth < 5 ? depth : 5;


        if (ast.type == "NUMBER")
        {
            this.emitNumber(ast, depth);
            if (!canUseExtraRegisters)
            this.emitInstruction(Decomposer.instruction.PUSH, {register: depth})
        }
        else if (ast.type == "IDENTIFIER")
        {
            this.emitIdentifier(ast, depth);
            if (!canUseExtraRegisters)
            this.emitInstruction(Decomposer.instruction.PUSH, {register: depth})
        }
        else if (ast.type == "BINARY")
        {
            this.emitBinary(ast, depth);
            if (!canUseExtraRegisters)
            this.emitInstruction(Decomposer.instruction.PUSH, {register: depth})
        }
        else
        {
            for (let i = 0; i < depth; i++)
            {
                this.emitInstruction(Decomposer.instruction.PUSH, {register: i})
            }
            this.decompose(ast);
            if (depth > 0)
            {
                this.emitInstruction(Decomposer.instruction.PUSH, {register: 0})

                if (canUseExtraRegisters)
                    this.emitInstruction(Decomposer.instruction.POP, {register: depth})
            }
            for (let i = depth-1; i >= 0; i--)
            {
                this.emitInstruction(Decomposer.instruction.POP, {register: i})
            }
        }
    }
    
    emitBinary(ast, depth = 0)
    {
        let canUseExtraRegisters = depth < 5;
        depth = depth < 5 ? depth : 5;

        this.emitDeepBranch(ast.left, depth);
        this.emitDeepBranch(ast.right, depth+1);
 
        if (!canUseExtraRegisters)
        {
            this.emitInstruction(Decomposer.instruction.POP, {register: depth+1})
            this.emitInstruction(Decomposer.instruction.POP, {register: depth})
        }

        switch (ast.operator)
        {
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
            case "==":
                this.emitInstruction(Decomposer.instruction.CMPEQ, {rl: depth+0, rr: depth+1})
                break;
            case ">":
                this.emitInstruction(Decomposer.instruction.CMPGT, {rl: depth+0, rr: depth+1})
                break;
            case "<":
                this.emitInstruction(Decomposer.instruction.CMPLT, {rl: depth+0, rr: depth+1})
                break;




            default: throw "Invalid operator"
        }
    }

    emitNumber(ast, register)
    {
        this.emitInstruction(Decomposer.instruction.LOADC, {
            data: parseFloat(ast.label),
            register: register
        });
    }
    
    emitString(ast, register)
    {
        this.emitInstruction(Decomposer.instruction.LOADC, {
            data: ast.label,
            register: register
        });
    }
    
    emitProg(ast)
    {
        for (let i = 0; i < ast.prog.length; i++)
        {
            this.decompose(ast.prog[i]);
            this.emitInstruction(Decomposer.instruction.NOP)
        }
    }

    join(v)
    {
        this.result.push(v);
    }

    emitInstruction(instr, params)
    {
        let dbgstr = this.lastByte.toString(16).padStart(4, "0")+": ";
        let res = []
        res.push(instr);
        switch (instr)
        {
            case Decomposer.instruction.LOADC:
                dbgstr += (`LOADC R${params.register} ${params.data}`);
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
            case Decomposer.instruction.DIV:
                dbgstr += (`DIV R${params.rl} R${params.rr}`);
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
            case Decomposer.instruction.CMPGT:
                dbgstr += (`CMPEQ R${params.rl} R${params.rr}`);
                res.push((params.rl << 4) | (params.rr & 0x0F))
                break;
            case Decomposer.instruction.CMPLT:
                dbgstr += (`CMPEQ R${params.rl} R${params.rr}`);
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
            case Decomposer.instruction.TBLSETR: 
                dbgstr += (`TBLSETR R${params.table} R${params.name} R${params.value}`);
                res.push((params.table << 4) | (params.name & 0x0F))
                res.push(params.value)
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
    ADD: 0x10,
    SUB: 0x11,
    MUL: 0x12,
    DIV: 0x13,
    JMP: 0x1F,
    CMPEQ: 0x20,
    CMPLT: 0x22,
    CMPGT: 0x24,
    JCF: 0x30,
    JCT: 0x31,
    POP: 0x40,
    PUSH: 0x41,
    TBLPUSH: 0x42,
    TBLSETR: 0x43,
    ENVGETC: 0x46,
    ENVSETC: 0x48
}

module.exports = Decomposer
