module.exports = class LexerRuleset
{
  constructor()
  {
    this.tokens = [];
  }

  each(callback)
  {
    this.tokens.forEach(callback);
  }

  add(regex, type)
  {
    this.tokens.push({
      expr: regex,
      type: type
    });
  }
}                                                                             
