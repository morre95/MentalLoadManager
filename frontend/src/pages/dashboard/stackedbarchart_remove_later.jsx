import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// #region Sample data
const data = [
    {
        name: 'Page A',
        uv: 4000,
        pv: 2400,
        rkew: 1234,
        amt: 2400,
    },
    {
        name: 'Page B',
        uv: 3000,
        pv: 1398,
        rkew: 5678,
        amt: 2210,
    },
    {
        name: 'Page C',
        uv: 2000,
        pv: 9800,
        rkew: 9012,
        amt: 2290,
    },
    {
        name: 'Page D',
        uv: 2780,
        pv: 3908,
        rkew: 3456,
        amt: 2000,
    },
    {
        name: 'Page E',
        uv: 1890,
        pv: 4800,
        rkew: 7890,
        amt: 2181,

    },
    {
        name: 'Page F',
        uv: 2390,
        pv: 3800,
        rkew: 2345,
        amt: 2500,
    },
    {
        name: 'Page G',
        uv: 3490,
        pv: 4300,
        rkew: 6789,
        amt: 2100,
    },
];

// #endregion
const StackedBarChart = () => {
    return (
        <BarChart
            style={{ width: '100%', maxWidth: '700px', maxHeight: '70vh', aspectRatio: 1.618 }}
            responsive
            data={data}
            margin={{
                top: 20,
                right: 0,
                left: 0,
                bottom: 5,
            }}
        >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis width="auto" />
            <Tooltip />
            <Legend />
            <Bar dataKey="pv" stackId="a" fill="#8884d8" background />
            <Bar dataKey="uv" stackId="a" fill="#82ca9d" background />
            <Bar dataKey="rkew" stackId="a" fill="#ff99cc" background />
        </BarChart>
    );
};

export default StackedBarChart;