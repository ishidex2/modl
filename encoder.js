/**
 *  TYPE           CODE
 *  nil             00
 *  bool/false      01
 *  bool/true       02
 *  uint8           03
 *  int32           04
 *  float64         05
 *  string          06
 *  uint8 array     07
 *  int32 array     08
 *  float64 array   09
 *  other array     0A
 */


class Encoder
{
    static encode(value)
    {
        if (value === null)
            return new Uint8Array([0x00]);
        if (value === false || value === true)
            return new Uint8Array([value + 1]);

        let result;
        if (Number.isInteger(value))
        {
            if (value >= 0 && value < 256)
            {
                result = new ArrayBuffer(2);
                let view = new DataView(result);
                view.setUint8(0, 0x03);
                view.setUint8(1, value);
            }
            else
            {
                result = new ArrayBuffer(5);
                let view = new DataView(result);
                view.setUint8(0, 0x04);
                view.setInt32(1, value);
            }
        }
        else if ('number' === typeof value)
        {
            result = new ArrayBuffer(9);
            let view = new DataView(result);
            view.setUint8(0, 0x05);
            view.setFloat64(1, value);
        }
        else if ('string' === typeof value)
        {
            let res = new TextEncoder().encode(value);
            return new Uint8Array([0x06, ...Encoder.encode(res.byteLength), ...res]);
        }
        else if (Array.isArray(value))
        {
            let subres = value.map(Encoder.encode);
            let subresarr = [];
            for (let v of subres)
                subresarr.push([...v]);
            return new Uint8Array([0x0A].concat([...Encoder.encode(value.length)], ...subresarr));
        }
        else
        {
            throw new Error('unsupported type for value:', value);
        }

        return new Uint8Array(result);
    }

    static decode(array, offset)
    {
        let buf = new ArrayBuffer(array.byteLength);
        let view = new DataView(buf);
        for (let i = 0; i < buf.byteLength; ++i)
            view.setUint8(i, array[i]);
        let shift = offset || 0;

        function decode_shifted()
        {
            if (array[shift] === 0x00)
            {
                shift += 1;
                return null;
            }
            if (array[shift] <= 0x02)
            {
                shift += 1;
                return array[shift - 1] === 0x02;
            }
            if (array[shift] === 0x03)
            {
                shift += 2;
                return view.getUint8(shift - 1);
            }
            if (array[shift] === 0x04)
            {
                shift += 1;
                let res = view.getInt32(shift);
                shift += 4;
                return res;
            }
            if (array[shift] === 0x05)
            {
                shift += 1;
                let res = view.getFloat64(shift);
                shift += 8;
                return res;
            }
            if (array[shift] === 0x06)
            {
                shift += 1;
                let length = decode_shifted();
                var ret = new TextDecoder().decode(buf.slice(shift, shift + length));
                shift += length;
                return ret;
            }

            if (array[shift] === 0x0A)
            {
                shift += 1;
                let length = decode_shifted();
                let rarr = [];
                for (let i = 0; i < length; ++i)
                    rarr.push(decode_shifted());
                return rarr;
            }

            shift += 1;
            return undefined;
        }

        return decode_shifted();
    }
}

module.exports = Encoder;
