module.exports = class Token
{
    error(msg)
    {
        throw new Error(`${msg}\n\tat line ${this.line+1}`);
        
    }

    constructor(label, type, line = null, lineStr)
    {
        this.lineStr = lineStr;
        this.line = line;
        this.label = label;
        this.type = type;
    }
}
