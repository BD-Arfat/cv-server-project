const express = require("express");
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET);

app.get("/", (req, res) => {
    res.send("hi hello")
});
app.use(cors());
app.use(express.json());

require('dotenv').config();



//////////////////////

const uri = `mongodb+srv://${process.env.DV_USER}:${process.env.DV_PASS}@cluster0.s0vwyit.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authHaders = req.headers.authorization;
    if (!authHaders) {
        return res.status(401).send("unauthorized access");

    }

    const token = authHaders.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })

}

const run = async () => {
    try {
        const appointmentCollection = client.db("doctorProtal").collection("appointment");
        const bookingTreatmentCollection = client.db("doctorProtal").collection("bookingTreatment");
        const userCollection = client.db("doctorProtal").collection("users");
        const doctorCollection = client.db("doctorProtal").collection("doctors");


        app.get("/appointment", async (req, res) => {
            const date = req.query.date;
            const query = {};
            const cursor = await appointmentCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date };
            const alreadyBooked = await bookingTreatmentCollection.find(bookingQuery).toArray();
            cursor.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.title);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
                option.slots = remainingSlots;
            })
            res.send(cursor);
        });

        // post doctor
        app.post('/doctors', async (req, res) => {
            const user = req.body;
            const result = await doctorCollection.insertOne(user);
            res.send(result)
        })
        // get doctor
        app.get('/doctors', async (req, res) => {
            const query = {};
            const cursor = await doctorCollection.find(query).toArray();
            res.send(cursor);
        })
        // delete doctor
        app.delete('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await doctorCollection.deleteOne(query);
            res.send(result)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        // admin
        app.put("/users/admin/:id", verifyJwt, async (req, res) => {

            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const option = { upsert: true }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc, option)
            res.send(result)
        });

        // app.get('/addPrice', async (req, res) => {
        //     const filter = {};
        //     const option = { upsert: true }
        //     const updateDoc = {
        //         $set: {
        //             price: 99
        //         }
        //     }
        //     const result = await appointmentCollection.updateMany(filter, updateDoc, option);
        //     res.send(result)
        // })

        // get payment 
        app.get('/bookingTreatment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const booking = await bookingTreatmentCollection.findOne(query);
            res.send(booking)
        })

        app.get('/bookingTreatment', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const booking = await bookingTreatmentCollection.find(query).toArray();
            res.send(booking);
        });

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
              });

        })

        // jwt token
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '45hr' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        // delete booking

        app.delete("/bookingTreatment/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingTreatmentCollection.deleteOne(query);
            res.send(result)
        });

        // delete users
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result)
        })

        // post users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user)
            res.send(result)
        });
        // get users
        app.get('/users', async (req, res) => {
            const query = {};
            const cursor = await userCollection.find(query).toArray();
            res.send(cursor);
        });
        app.post('/bookingTreatment', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }
            const alreadyBooked = await bookingTreatmentCollection.find(query).toArray();

            if (alreadyBooked.length) {
                const message = `You Already Have a Booking on ${booking.appointmentDate}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingTreatmentCollection.insertOne(booking);
            res.send(result)
        })
    }
    finally {

    }
}
run();



//////////////////////

app.listen(port, () => {
    console.log(`hi hello ${port}`)
})

module.exports = app;