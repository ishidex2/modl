class Decomposer
{
    start(ast) 
    {
        this.result = [];
        this.labels = [];

        this.decompose(ast);
        return new Uint8Array(this.result);
    }

    decompose(ast)
    {
        switch (ast.type)
        {
            case "PROG":
                this.decomposeProg(ast)
            case "NUMBER":

        }
    }

    decomposeProg(ast)
    {
        for (let i = 0; i < ast.prog.length; i++)
        {
            this.decompose(ast);
        }
    }

    emitNumber(num)
    {
        return [num&0xFF000000>>24, num&0xFF0000>>16, num&0x
    }

    constructor()
    {
    }

    createLabel()
    {
        this.labels.push(this.result.length);
        return this.labels.length-1; // Id of label
    }

    resolveLabel(id)
    {
        this.result[this.labels[id]]
    }


    emitByte(b)
    {
        this.result.push(b);
    }
}


Decomposer.instruction = {
    LOADC: 0x04   
}
