const express = require("express");
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

app.get("/", (req,res)=>{
    res.send("hi hello")
});
app.use(cors());
app.use(express.json());

require('dotenv').config();



//////////////////////

const uri = `mongodb+srv://${process.env.DV_USER}:${process.env.DV_PASS}@cluster0.s0vwyit.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const run =() =>{
    try{
        const appointmentCollection = client.db("doctorProtal").collection("appointment");
        const bookingTreatmentCollection = client.db("doctorProtal").collection("bookingTreatment");
        

        app.get("/appointment", async(req, res)=>{
            const date = req.query.date;
            console.log(date);
            const query = {};
            const cursor = await appointmentCollection.find(query).toArray();
            const bookingQuery = {appointmentDate : date};
            const alreadyBooked = await bookingTreatmentCollection.find(bookingQuery).toArray();
            cursor.forEach(option =>{
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.title);
                const bookedSlots = optionBooked.map(book =>book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
                option.slots = remainingSlots;
            })
            res.send(cursor);
        });

        app.post('/bookingTreatment', async(req, res)=>{
            const booking = req.body;
            const query = {
                appointmentDate : booking.appointmentDate,
                email : booking.email,
                treatment : booking.treatment
            }
            const alreadyBooked = await bookingTreatmentCollection.find(query).toArray();
            
            if(alreadyBooked.length){
                const message = `You Already Have a Booking on ${booking.appointmentDate}`
                return res.send({acknowledged : false, message})
            }
            const result = await bookingTreatmentCollection.insertOne(booking);
            res.send(result)
        })
    }
    finally{

    }
}
run();



//////////////////////

app.listen(port,()=>{
    console.log(`hi hello ${port}`)
})