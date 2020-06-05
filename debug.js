class Debug
{
    constructor()
    {
        this._start_time = process.hrtime();
        this.timers = [[0, process.hrtime(this._start_time), '__process__', null, []]];
        this._next_timer_id = 1;
        this._log = [];
    }

    begin(name, info)
    {
        info = info || null;
        let timer = [this._next_timer_id, process.hrtime(this._start_time), name, info, []];
        this.event('__timer_start__', timer);
        this.timers.push(timer);
        this._next_timer_id += 1;
    }

    event(name, data)
    {
        this.timers[this.timers.length - 1][4].push([name, process.hrtime(this._start_time), data]);
    }

    end(name)
    {
        let timer = this.timers[this.timers.length - 1];
        let start = timer[1];
        let end = process.hrtime(this._start_time);
        let interval = [end[0] - start[0], end[1] - start[1]];
        if (interval[1] < 0)
        {
            interval[1] += 1000000000;
            interval[0] -= 1;
        }
        
        this.event('__duration__', interval);
        this.timers.pop();
        return timer;
    }

    static getTimerEventData(timer, name)
    {
        return (timer[4].find(e => e[0] === name) || [0,0,undefined])[2];
    }

    dumpTimers()
    {
        function pad(n, width, z)
        {
            z = z === undefined ? '0' : z;
            n = `${n}`;
            return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        }

        let self = this;
        function __dump_timer(timer)
        {
            let duration = Debug.getTimerEventData(timer, '__duration__') || process.hrtime(self._start_time);
            let res = `\u001b[32m${timer[2]}\u001b[0m(\u001b[33m${timer[0]}\u001b[0m): \u001b[37;1mduration\u001b[0m=\u001b[33m${duration[0]}.${pad(duration[1], 9)}\u001b[0m`;
            let events = (timer[4].filter(e => e[0] !== '__duration__').map(
                e => e[0] === '__timer_start__'
                    ? `  [ \u001b[32m_\u001b[0m ] \u001b[37;1mat\u001b[0m=\u001b[33m${e[1][0]}.${pad(e[1][1], 9)}\u001b[0m\n    ${__dump_timer(e[2], 1).replace(/\n/g, '\n    ')}`
                    : `  [ \u001b[32m${e[0]}\u001b[0m ] \u001b[37;1mat\u001b[0m=\u001b[33m${e[1][0]}.${pad(e[1][1], 9)}\u001b[0m ` + (JSON.stringify(e[2] || null))
            )).join('\n');
            if (events !== '')
                return res + '\n' + events;
            return res;
        }

        console.log(__dump_timer(this.timers[0], 0));
    }
}

module.exports = new Debug();
