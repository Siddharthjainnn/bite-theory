"use client";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ShoppingCart, Star, Flame, Leaf, Plus, Minus, Clock,
  Truck, ShieldCheck, Salad, Quote, ChevronLeft, ChevronRight,
} from "lucide-react";

type Meal = {
  id: number; name: string; desc: string; price: number; offer: number;
  cal: number; protein: number; rating: number; category: string; emoji: string;
};

const MEALS: Meal[] = [
  { id: 1, name: "Power Protein Thali", desc: "Dal, paneer, brown rice, salad", price: 199, offer: 149, cal: 540, protein: 32, rating: 4.7, category: "Thali", emoji: "🍛" },
  { id: 2, name: "Grilled Chicken Bowl", desc: "Lean chicken, quinoa, greens", price: 249, offer: 199, cal: 480, protein: 41, rating: 4.8, category: "Protein", emoji: "🥗" },
  { id: 3, name: "Green Detox Breakfast", desc: "Oats, fruits, chia, nuts", price: 149, offer: 99, cal: 320, protein: 14, rating: 4.6, category: "Breakfast", emoji: "🥣" },
  { id: 4, name: "Paneer Tikka Wrap", desc: "Whole wheat, paneer, veggies", price: 179, offer: 139, cal: 410, protein: 22, rating: 4.5, category: "Lunch", emoji: "🌯" },
  { id: 5, name: "Sprout Salad Snack", desc: "Mixed sprouts, lemon, herbs", price: 99, offer: 79, cal: 210, protein: 16, rating: 4.4, category: "Snacks", emoji: "🥙" },
  { id: 6, name: "Cold Pressed Juice", desc: "Beetroot, carrot, ginger", price: 129, offer: 89, cal: 140, protein: 3, rating: 4.6, category: "Beverages", emoji: "🥤" },
];

const CATEGORIES = ["All", "Thali", "Protein", "Breakfast", "Lunch", "Snacks", "Beverages"];

const OFFERS = [
  { title: "Flat 40% OFF", sub: "On your first order", code: "BITE40", bg: "from-[#4CAF50] to-[#0D3B2E]" },
  { title: "Meals under ₹99", sub: "Everyday healthy combos", code: "UNDER99", bg: "from-[#F59E0B] to-[#0D3B2E]" },
  { title: "Free Delivery", sub: "On orders above ₹299", code: "FREESHIP", bg: "from-[#0D3B2E] to-[#4CAF50]" },
];

const WHY = [
  { icon: Salad, label: "Balanced Nutrition" },
  { icon: Leaf, label: "Fresh Ingredients" },
  { icon: Clock, label: "On Time, Every Time" },
  { icon: ShieldCheck, label: "No Compromise" },
];

const REVIEWS = [
  { name: "Aarav S.", text: "Best healthy thali in the city. Tastes amazing and keeps me full!", rating: 5 },
  { name: "Priya M.", text: "Love the protein bowls. Perfect for my gym routine.", rating: 5 },
  { name: "Rohan K.", text: "On-time delivery and super fresh. Highly recommend.", rating: 4 },
];

export default function Home() {
  const [active, setActive] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [slide, setSlide] = useState(0);
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % OFFERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const filtered = active === "All" ? MEALS : MEALS.filter((m) => m.category === active);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const meal = MEALS.find((m) => m.id === Number(id));
    return sum + (meal ? meal.offer * qty : 0);
  }, 0);

  const add = (id: number) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const remove = (id: number) =>
    setCart((c) => {
      const n = { ...c };
      if (n[id] > 1) n[id] -= 1; else delete n[id];
      return n;
    });

  return (
    <main className="min-h-screen bg-[#0D3B2E] text-white overflow-x-hidden">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 glass">
        <div className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="Bite Theory" width={38} height={38} className="rounded-full object-cover" />
          <span className="text-lg font-extrabold tracking-tight">
            Bite <span className="text-[#4CAF50]">Theory</span>
          </span>
        </div>
        <div className="relative">
          <ShoppingCart size={22} />
          {cartCount > 0 && (
            <motion.span
              key={cartCount}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 bg-[#F59E0B] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
            >
              {cartCount}
            </motion.span>
          )}
        </div>
      </nav>

      {/* HERO — ad poster style */}
      <section ref={heroRef} className="relative h-[88vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity }}
          className="absolute inset-0 bg-gradient-to-br from-[#0D3B2E] via-[#145c44] to-[#0D3B2E]"
        />
        {/* floating food emojis */}
        {["🥗", "🍛", "🥑", "🥤", "🍅"].map((e, i) => (
          <motion.span
            key={i}
            className="absolute text-4xl md:text-6xl opacity-20 float"
            style={{ left: `${15 + i * 18}%`, top: `${10 + (i % 3) * 25}%`, animationDelay: `${i * 0.6}s` }}
          >
            {e}
          </motion.span>
        ))}

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, delay: 0.1 }}
          className="relative z-10 mb-4"
        >
          <Image src="/logo.jpeg" alt="Bite Theory" width={90} height={90} className="rounded-full shadow-2xl ring-4 ring-[#F59E0B]/40" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative z-10 text-4xl md:text-6xl font-extrabold leading-tight"
        >
          Smart Food.<br />
          <span className="text-[#4CAF50]">Better Living.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 0.9 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative z-10 mt-4 text-base md:text-lg max-w-md text-green-100"
        >
          Healthy thalis & protein meals delivered fresh — <span className="text-[#F59E0B] font-bold">under ₹99</span>
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="relative z-10 mt-8 bg-[#F59E0B] text-[#0D3B2E] font-extrabold px-10 py-3.5 rounded-full shadow-xl shadow-orange-500/30"
        >
          Order Now
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-6 text-xs text-green-200 animate-bounce"
        >
          ↓ scroll to explore
        </motion.div>
      </section>

      {/* OFFERS SLIDER */}
      <section className="px-5 -mt-10 relative z-20">
        <div className="relative h-32 rounded-3xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 bg-gradient-to-r ${OFFERS[slide].bg} flex flex-col justify-center px-6`}
            >
              <h3 className="text-2xl font-extrabold">{OFFERS[slide].title}</h3>
              <p className="text-sm text-green-50">{OFFERS[slide].sub}</p>
              <span className="mt-2 inline-block w-fit bg-white/20 text-xs px-3 py-1 rounded-full font-mono">
                CODE: {OFFERS[slide].code}
              </span>
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
            {OFFERS.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        </div>
      </section>

      {/* WHY BITE THEORY */}
      <section className="px-5 py-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-xl font-bold mb-5 text-center"
        >
          Why <span className="text-[#4CAF50]">Bite Theory</span>?
        </motion.h2>
        <div className="grid grid-cols-2 gap-3">
          {WHY.map((w, i) => (
            <motion.div
              key={w.label}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-4 flex flex-col items-center text-center gap-2"
            >
              <w.icon className="text-[#F59E0B]" size={28} />
              <span className="text-sm font-medium">{w.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="px-5 pt-2">
        <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setActive(c)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition ${
                active === c ? "bg-[#4CAF50] text-white" : "glass text-green-100"
              }`}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* MEALS */}
      <section className="px-5 py-6 pb-32">
        <h2 className="text-xl font-bold mb-4">Popular Meals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              whileHover={{ y: -6 }}
              className="glass rounded-3xl overflow-hidden"
            >
              <div className="relative text-6xl text-center py-8 bg-white/5">
                <motion.span whileHover={{ scale: 1.2, rotate: 8 }} className="inline-block">{m.emoji}</motion.span>
                <span className="absolute top-3 left-3 bg-[#F59E0B] text-[#0D3B2E] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {Math.round((1 - m.offer / m.price) * 100)}% OFF
                </span>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold">{m.name}</h3>
                  <span className="flex items-center gap-1 text-xs bg-[#4CAF50] px-2 py-0.5 rounded-full shrink-0">
                    <Star size={12} className="fill-white" /> {m.rating}
                  </span>
                </div>
                <p className="text-xs text-green-200 mt-1">{m.desc}</p>
                <div className="flex gap-3 mt-3 text-[11px] text-green-100">
                  <span className="flex items-center gap-1"><Flame size={13} className="text-[#F59E0B]" /> {m.cal} cal</span>
                  <span className="flex items-center gap-1"><Leaf size={13} className="text-[#4CAF50]" /> {m.protein}g protein</span>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div>
                    <span className="font-extrabold text-lg">₹{m.offer}</span>
                    <span className="text-xs text-green-300 line-through ml-2">₹{m.price}</span>
                  </div>
                  {cart[m.id] ? (
                    <div className="flex items-center gap-2 bg-[#4CAF50] rounded-full px-2 py-1.5">
                      <button onClick={() => remove(m.id)}><Minus size={15} /></button>
                      <span className="font-bold w-4 text-center text-sm">{cart[m.id]}</span>
                      <button onClick={() => add(m.id)}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => add(m.id)}
                      className="bg-[#F59E0B] text-[#0D3B2E] font-bold px-4 py-2 rounded-full flex items-center gap-1 text-sm">
                      <Plus size={15} /> Add
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section className="px-5 pb-32">
        <h2 className="text-xl font-bold mb-4">What customers say</h2>
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {REVIEWS.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-5 min-w-[260px]"
            >
              <Quote className="text-[#F59E0B] mb-2" size={22} />
              <p className="text-sm text-green-100">{r.text}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="font-semibold text-sm">{r.name}</span>
                <span className="flex">{Array.from({ length: r.rating }).map((_, k) => (
                  <Star key={k} size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
                ))}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* STICKY CART */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#4CAF50] px-5 py-4 flex justify-between items-center shadow-2xl"
          >
            <div>
              <p className="text-xs text-green-50">{cartCount} item{cartCount > 1 ? "s" : ""}</p>
              <p className="font-extrabold text-lg">₹{cartTotal}</p>
            </div>
            <button className="bg-[#F59E0B] text-[#0D3B2E] font-extrabold px-6 py-2.5 rounded-full">
              View Cart →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}