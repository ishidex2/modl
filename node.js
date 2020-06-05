let debug = require('./debug')

const NodeType = {
    INV: -1,
    NUM: 0,
    STR: 1,
    TBL: 2,
    NIL: 3,
    FUN: 4
}

class Node
{
    constructor(type, value, meta = {})
    {
        this.type = type;
        this.value = value;
        this.meta = meta;
    }

    call(runtime, env)
    {
        // debug.begin('node.call')
        if (this.type !== NodeType.FUN)
        {
            debug.end('node.call')
            throw new Error("Attempt to call on non-function "+this.type)   
        }

        let ret
        if (this.meta.native)
        {
            ret = this.value(runtime, env)
        }
        else
        {
            ret = runtime.call(this.value)
        }

        // debug.end('node.call')
        return ret
    }
    
    push(v)
    {
        if (this.type !== NodeType.TBL)
        {
            throw new Error("Attempt to push value into non-table of type "+Node.strType(this.type)+" with value of "+Node.dump(this))   
        }    

        while (this.value[this.meta.lastIndex] ? this.value[this.meta.lastIndex].type !== NodeType.NIL : false)
        {
            this.meta.lastIndex += 1
        }
        this.value[this.meta.lastIndex++] = v
        return this
    }

    copy(node)
    {
    }

    tsetProto(proto)
    {
        for (let i in proto.value)
        {
            if (proto.value[i].type == NodeType.STR)
                this.value[i] = Node.newString(proto.value[i].value)
            else if (proto.value[i].type == NodeType.NUM)
                this.value[i] = Node.newNumber(proto.value[i].value)
            else 
                this.value[i] = proto.value[i]
        }
        return this
    }

    length()
    {
        if (this.type !== NodeType.TBL && this.type !== NodeType.STR)
        {
            throw new Error("Attempt to get length of non-table or non-string of type "+Node.strType(this.type))   
        }    

        return Node.newNumber(this.type === NodeType.STR ? this.value.length : this.meta.lastIndex)
    }

    tset(k, v, returnChild = true)
    {
        if (this.type !== NodeType.TBL)
        {
            throw new Error("Attempt to set value '"+Node.dump(k)+"' into non-table of type "+Node.strType(this.type)+" with value of "+Node.dump(this))   
        }    

        this.value[k.value] = v
        if (returnChild)
            return this.value[k.value]
        else
            return this
    }

    static strType(type)
    {
        switch(type)
        {
            case NodeType.NUM:
                return "number"
            case NodeType.STR:
                return "string"
            case NodeType.TBL:
                return "table"
            case NodeType.NIL:
                return "nil"
            case NodeType.FUN:
                return "function"
        }
    }

    
    tget(k)
    {
        if (this.type !== NodeType.TBL && this.type !== NodeType.STR)
        {
            throw new Error("Attempt to get value '"+Node.dump(k)+"' from non-table of type "+Node.strType(this.type)+" with value of "+Node.dump(this))   
        }    

        if (this.type === NodeType.STR) return this.value[k.value] ? Node.newString(this.value[k.value]) : Node.newNil() 


        return this.value[k.value] ? this.value[k.value] : Node.newNil() 
    }

    static newNumber(n)
    {
        if (typeof n in ["boolean", "number"]) throw new Error("Attempt to instantiate number node with non-number value")
        return new Node(NodeType.NUM, n)
    }

    static newString(n)
    {
        if (typeof n !== "string") throw new Error("Attempt to instantiate string node with non-string value")

        return new Node(NodeType.STR, n)
    }

    static newTable(n, lastIndex = 0)
    {
        if (typeof n !== "object") throw new Error("Attempt to instantiate table node with non-object value")

        return new Node(NodeType.TBL, n, {lastIndex: lastIndex, prototype: this.newNil()})
    }


    static newNil()
    {
        return new Node(NodeType.NIL, null)
    }

    static newFun(ptr, native = true, argc = 0)
    {
        if (native)
            return new Node(NodeType.FUN, ptr, {native: true})
        else if (typeof ptr == "number")
            return new Node(NodeType.FUN, ptr, {native: false})
        throw new Error("Non-native function must be a number that points to location!")
    }

    static dump(p, rootDepth = true)
    {
        if (!(p instanceof Node)) return p+"?"
        if (p.type == NodeType.TBL)
        {
            let r = "["
            // return "["+p.value.map((e) => Node.dump(e, false)).join()+"]";
            let zero = true
            for (let i in p.value)
            {
                zero = false
                r += `${!isNaN(i) ? "" : `"${i}": `}${Node.dump(p.value[i], false)}, `
            }
            if (!zero)
                r = r.slice(0, -2);
            r += "]";
            return r;
        }
        if (p.type == NodeType.STR)
        {
            if (!rootDepth || true)
            {
                return "\""+p.value+"\"";
            }
            else return p.value;
        }
        if (p.type == NodeType.NUM)
        {
            return p.value+"";
        }
        if (p.type == NodeType.FUN)
        {
            return `#${p.meta.native ? "native_" : ""}function${!p.meta.native ? p.value : ""}`
        }
        if (p.type == NodeType.NIL) return "nil"
    }

    // static newTable(n)
    // {
    //     return new Node(NodeType.TBL, n)
    // }
}

module.exports.NodeType = NodeType
module.exports.Node = Node