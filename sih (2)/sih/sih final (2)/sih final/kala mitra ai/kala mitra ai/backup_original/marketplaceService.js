/**
 * Marketplace Service
 * Manages craft categories and products data
 */

export const CRAFT_CATEGORIES = [
  { id: 1, name: "Bamboo & Cane Crafts", icon: "🎋", count: 42, image: "https://spaindustrialdesign.wordpress.com/wp-content/uploads/2020/12/1-7.jpg?w=1200" },
  { id: 2, name: "Handloom & Textiles", icon: "🧵", count: 36, image: "https://www.laxhaclothing.com/cdn/shop/articles/8102993d0fa915fec35f5bf9a8778239.png?v=1747742238" },
  { id: 3, name: "Pottery & Terracotta", icon: "🏺", count: 31, image: "https://cdn.shopify.com/s/files/1/0046/7193/0458/files/terracotta_pottery_wheel_large.jpg?v=1578035729" },
  { id: 4, name: "Wood Crafts", icon: "🪵", count: 28, image: "https://i0.wp.com/bastariya.com/wp-content/uploads/2023/03/wood-art-image-1024x1024.jpg?resize=466%2C466&ssl=1" },
  { id: 5, name: "Embroidery & Textiles", icon: "🪡", count: 24, image: "https://www.unnatisilks.com/cdn/shop/articles/Hand-Embroidered-Kit-DIY-Cross-Stitch-Kit-Manual-Needlework-Embroidery-kit-For-Beginners-Gift-Decoration-Embroidery.jpg_960x960_2fab2545-c6fe-4102-a434-d6011677cfc6.jpg?v=1655295175&width=2048" },
  { id: 6, name: "Handmade Bags & Accessories", icon: "👜", count: 27, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
  { id: 7, name: "Handmade Jewellery", icon: "💍", count: 22, image: "https://bongoniketan.in/cdn/shop/files/buyhandmadecloth_kanthabeadsjewelleryfromsonajhurihaatsantiniketanwestbengalbybongoniketanartisansonline18_30a7e40b-41a2-40e5-9eea-c20a99ed13d5.jpg?v=1750079243&width=1946" },
  { id: 8, name: "Handmade Toys & Dolls", icon: "🧸", count: 18, image: "https://shop.gaatha.com/image/cache/catalog/Gaatha/013-wooden-toys-(2)-900x900.jpg" },
  { id: 9, name: "Folk Art & Wall Decor", icon: "🎨", count: 20, image: "https://kotart.in/cdn/shop/files/CanvasAL774-4.jpg?v=1779620155" },
];

export const SAMPLE_PRODUCTS = [
  // Bamboo & Cane Crafts (6 products)
  {
    id: 1,
    title: "Handwoven Bamboo Storage Basket",
    craft_type: "Bamboo & Cane Crafts",
    location_city: "Guwahati",
    price: 640,
    lead_time_days: 9,
    monthly_capacity: 960,
    demand_score: 88,
    description: "Artisan-crafted bamboo storage basket with traditional weaving techniques.",
  },
  {
    id: 2,
    title: "Bamboo Tea Table Set",
    craft_type: "Bamboo & Cane Crafts",
    location_city: "Kerala",
    price: 1200,
    lead_time_days: 10,
    monthly_capacity: 480,
    demand_score: 85,
    description: "Elegant bamboo table set perfect for tea service and hospitality.",
  },
  {
    id: 3,
    title: "Cane Garden Stool",
    craft_type: "Bamboo & Cane Crafts",
    location_city: "Shillong",
    price: 850,
    lead_time_days: 8,
    monthly_capacity: 720,
    demand_score: 82,
    description: "Durable cane stool crafted for outdoor and indoor use.",
  },
  {
    id: 4,
    title: "Bamboo Wall Mounted Shelf",
    craft_type: "Bamboo & Cane Crafts",
    location_city: "Guwahati",
    price: 920,
    lead_time_days: 7,
    monthly_capacity: 540,
    demand_score: 86,
    description: "Modern bamboo shelf design for contemporary home decor.",
  },
  {
    id: 5,
    title: "Hand-Carved Bamboo Lamp",
    craft_type: "Bamboo & Cane Crafts",
    location_city: "Kerala",
    price: 1450,
    lead_time_days: 12,
    monthly_capacity: 360,
    demand_score: 89,
    description: "Artisan-carved bamboo lamp with intricate traditional patterns.",
  },
  {
    id: 6,
    title: "Bamboo Picnic Hamper",
    craft_type: "Bamboo & Cane Crafts",
    location_city: "Shillong",
    price: 1650,
    lead_time_days: 11,
    monthly_capacity: 300,
    demand_score: 87,
    description: "Premium bamboo hamper perfect for outdoor adventures and gifting.",
  },

  // Handloom & Textiles (6 products)
  {
    id: 7,
    title: "Handwoven Banarasi Silk Saree",
    craft_type: "Handloom & Textiles",
    location_city: "Varanasi",
    price: 2450,
    lead_time_days: 12,
    monthly_capacity: 420,
    demand_score: 96,
    description: "Pure silk handcrafted by master weavers with GI-certified heritage.",
  },
  {
    id: 8,
    title: "Handloom Cotton Table Runner",
    craft_type: "Handloom & Textiles",
    location_city: "Vellore",
    price: 510,
    lead_time_days: 7,
    monthly_capacity: 900,
    demand_score: 85,
    description: "Contemporary woven table runners crafted for boutique hotels.",
  },
  {
    id: 9,
    title: "Dhoti & Towel Set",
    craft_type: "Handloom & Textiles",
    location_city: "Thanjavur",
    price: 680,
    lead_time_days: 8,
    monthly_capacity: 700,
    demand_score: 83,
    description: "Traditional handloom dhoti set with organic cotton weaving.",
  },
  {
    id: 10,
    title: "Handwoven Shawl",
    craft_type: "Handloom & Textiles",
    location_city: "Varanasi",
    price: 1200,
    lead_time_days: 10,
    monthly_capacity: 550,
    demand_score: 88,
    description: "Elegant handwoven shawl with natural dye accents.",
  },
  {
    id: 11,
    title: "Handloom Bedspread",
    craft_type: "Handloom & Textiles",
    location_city: "Vellore",
    price: 1800,
    lead_time_days: 14,
    monthly_capacity: 280,
    demand_score: 91,
    description: "Premium handloom bedspread with heritage patterns and finishes.",
  },
  {
    id: 12,
    title: "Silk & Cotton Blend Fabric",
    craft_type: "Handloom & Textiles",
    location_city: "Thanjavur",
    price: 450,
    lead_time_days: 6,
    monthly_capacity: 1200,
    demand_score: 84,
    description: "Versatile silk-cotton blend fabric for various textile applications.",
  },

  // Pottery & Terracotta (6 products)
  {
    id: 13,
    title: "Terracotta Diya Set",
    craft_type: "Pottery & Terracotta",
    location_city: "Jaipur",
    price: 320,
    lead_time_days: 7,
    monthly_capacity: 1800,
    demand_score: 92,
    description: "Eco-friendly festival-ready incense and diya sets.",
  },
  {
    id: 14,
    title: "Handmade Pottery Jug",
    craft_type: "Pottery & Terracotta",
    location_city: "Khurja",
    price: 480,
    lead_time_days: 8,
    monthly_capacity: 850,
    demand_score: 86,
    description: "Traditional pottery jug with hand-painted designs.",
  },
  {
    id: 15,
    title: "Terracotta Plant Pot Set",
    craft_type: "Pottery & Terracotta",
    location_city: "Jaipur",
    price: 620,
    lead_time_days: 6,
    monthly_capacity: 1100,
    demand_score: 88,
    description: "Beautiful terracotta pots perfect for home gardening.",
  },
  {
    id: 16,
    title: "Pottery Dinnerware Set",
    craft_type: "Pottery & Terracotta",
    location_city: "Khurja",
    price: 1100,
    lead_time_days: 10,
    monthly_capacity: 600,
    demand_score: 89,
    description: "Premium handmade pottery dinnerware with glaze finish.",
  },
  {
    id: 17,
    title: "Decorative Terracotta Sculpture",
    craft_type: "Pottery & Terracotta",
    location_city: "Jaipur",
    price: 1600,
    lead_time_days: 12,
    monthly_capacity: 400,
    demand_score: 85,
    description: "Artistic terracotta sculpture for premium home decor.",
  },
  {
    id: 18,
    title: "Pottery Water Cooler",
    craft_type: "Pottery & Terracotta",
    location_city: "Khurja",
    price: 2200,
    lead_time_days: 14,
    monthly_capacity: 250,
    demand_score: 87,
    description: "Traditional pottery water cooler with natural cooling properties.",
  },

  // Wood Crafts (6 products)
  {
    id: 19,
    title: "Hand-Carved Wooden Bowl Set",
    craft_type: "Wood Crafts",
    location_city: "Bhubaneswar",
    price: 1500,
    lead_time_days: 11,
    monthly_capacity: 360,
    demand_score: 90,
    description: "Solid wood artisan bowl sets crafted for premium home decor.",
  },
  {
    id: 20,
    title: "Wooden Wall Art Panel",
    craft_type: "Wood Crafts",
    location_city: "Saharanpur",
    price: 1800,
    lead_time_days: 12,
    monthly_capacity: 320,
    demand_score: 88,
    description: "Intricately carved wooden wall panels with traditional patterns.",
  },
  {
    id: 21,
    title: "Handcrafted Wooden Spoon Set",
    craft_type: "Wood Crafts",
    location_city: "Bhubaneswar",
    price: 420,
    lead_time_days: 6,
    monthly_capacity: 1200,
    demand_score: 83,
    description: "Food-safe wooden spoons handcrafted by artisans.",
  },
  {
    id: 22,
    title: "Wooden Jewelry Box",
    craft_type: "Wood Crafts",
    location_city: "Saharanpur",
    price: 1200,
    lead_time_days: 10,
    monthly_capacity: 500,
    demand_score: 87,
    description: "Elegantly carved wooden jewelry box with compartments.",
  },
  {
    id: 23,
    title: "Wooden Table Lamp",
    craft_type: "Wood Crafts",
    location_city: "Bhubaneswar",
    price: 980,
    lead_time_days: 9,
    monthly_capacity: 600,
    demand_score: 85,
    description: "Hand-carved wooden lamp base with modern design.",
  },
  {
    id: 24,
    title: "Wooden Door Frame",
    craft_type: "Wood Crafts",
    location_city: "Saharanpur",
    price: 3200,
    lead_time_days: 16,
    monthly_capacity: 150,
    demand_score: 89,
    description: "Premium carved wooden door frame for architectural projects.",
  },

  // Embroidery & Textiles (6 products)
  {
    id: 25,
    title: "Hand-Embroidered Cushion Cover",
    craft_type: "Embroidery & Textiles",
    location_city: "Jaipur",
    price: 580,
    lead_time_days: 8,
    monthly_capacity: 750,
    demand_score: 87,
    description: "Beautiful hand-embroidered cushion cover with traditional designs.",
  },
  {
    id: 26,
    title: "Embroidered Saree",
    craft_type: "Embroidery & Textiles",
    location_city: "Lucknow",
    price: 2100,
    lead_time_days: 14,
    monthly_capacity: 300,
    demand_score: 92,
    description: "Exquisite hand-embroidered saree with chikankari work.",
  },
  {
    id: 27,
    title: "Embroidered Wall Hanging",
    craft_type: "Embroidery & Textiles",
    location_city: "Jaipur",
    price: 820,
    lead_time_days: 10,
    monthly_capacity: 600,
    demand_score: 85,
    description: "Artistic embroidered wall hanging for home decoration.",
  },
  {
    id: 28,
    title: "Hand-Embroidered Dress",
    craft_type: "Embroidery & Textiles",
    location_city: "Lucknow",
    price: 1600,
    lead_time_days: 12,
    monthly_capacity: 400,
    demand_score: 88,
    description: "Premium hand-embroidered traditional dress.",
  },
  {
    id: 29,
    title: "Embroidered Bedsheet Set",
    craft_type: "Embroidery & Textiles",
    location_city: "Jaipur",
    price: 1450,
    lead_time_days: 11,
    monthly_capacity: 450,
    demand_score: 86,
    description: "Beautiful embroidered bedsheet set with quality cotton.",
  },
  {
    id: 30,
    title: "Hand-Embroidered Clutch Bag",
    craft_type: "Embroidery & Textiles",
    location_city: "Lucknow",
    price: 720,
    lead_time_days: 7,
    monthly_capacity: 800,
    demand_score: 84,
    description: "Elegant hand-embroidered clutch perfect for occasions.",
  },

  // Handmade Bags & Accessories (6 products)
  {
    id: 31,
    title: "Leather Shoulder Bag",
    craft_type: "Handmade Bags & Accessories",
    location_city: "Bangalore",
    price: 1800,
    lead_time_days: 11,
    monthly_capacity: 400,
    demand_score: 89,
    description: "Premium handmade leather shoulder bag with quality finish.",
  },
  {
    id: 32,
    title: "Jute Market Tote",
    craft_type: "Handmade Bags & Accessories",
    location_city: "Kolkata",
    price: 420,
    lead_time_days: 6,
    monthly_capacity: 1100,
    demand_score: 87,
    description: "Durable woven jute totes for boutiques and gifting.",
  },
  {
    id: 33,
    title: "Handmade Leather Belt",
    craft_type: "Handmade Bags & Accessories",
    location_city: "Bangalore",
    price: 680,
    lead_time_days: 7,
    monthly_capacity: 900,
    demand_score: 84,
    description: "Classic handmade leather belt with authentic craftsmanship.",
  },
  {
    id: 34,
    title: "Canvas Backpack",
    craft_type: "Handmade Bags & Accessories",
    location_city: "Delhi",
    price: 1200,
    lead_time_days: 9,
    monthly_capacity: 600,
    demand_score: 86,
    description: "Sturdy canvas backpack with hand-stitched details.",
  },
  {
    id: 35,
    title: "Handwoven Bag",
    craft_type: "Handmade Bags & Accessories",
    location_city: "Kolkata",
    price: 950,
    lead_time_days: 8,
    monthly_capacity: 700,
    demand_score: 85,
    description: "Beautifully handwoven bag with natural fibers.",
  },
  {
    id: 36,
    title: "Leather Laptop Bag",
    craft_type: "Handmade Bags & Accessories",
    location_city: "Bangalore",
    price: 2400,
    lead_time_days: 12,
    monthly_capacity: 300,
    demand_score: 90,
    description: "Premium leather laptop bag with organization compartments.",
  },

  // Handmade Jewellery (6 products)
  {
    id: 37,
    title: "Silver Beaded Necklace",
    craft_type: "Handmade Jewellery",
    location_city: "Jaipur",
    price: 820,
    lead_time_days: 8,
    monthly_capacity: 750,
    demand_score: 88,
    description: "Elegant silver beaded necklace with traditional craftsmanship.",
  },
  {
    id: 38,
    title: "Kundan Jewelry Set",
    craft_type: "Handmade Jewellery",
    location_city: "Jaipur",
    price: 2200,
    lead_time_days: 12,
    monthly_capacity: 350,
    demand_score: 92,
    description: "Exquisite kundan jewelry set for weddings and occasions.",
  },
  {
    id: 39,
    title: "Handmade Brass Earrings",
    craft_type: "Handmade Jewellery",
    location_city: "Delhi",
    price: 420,
    lead_time_days: 5,
    monthly_capacity: 1300,
    demand_score: 82,
    description: "Artistic handmade brass earrings with unique designs.",
  },
  {
    id: 40,
    title: "Stone-Studded Bangle Set",
    craft_type: "Handmade Jewellery",
    location_city: "Jaipur",
    price: 1100,
    lead_time_days: 9,
    monthly_capacity: 650,
    demand_score: 87,
    description: "Beautiful stone-studded bangle set with traditional appeal.",
  },
  {
    id: 41,
    title: "Tribal Silver Pendant",
    craft_type: "Handmade Jewellery",
    location_city: "Bangalore",
    price: 650,
    lead_time_days: 7,
    monthly_capacity: 850,
    demand_score: 85,
    description: "Authentic tribal silver pendant with cultural significance.",
  },
  {
    id: 42,
    title: "Gemstone Ring",
    craft_type: "Handmade Jewellery",
    location_city: "Jaipur",
    price: 1800,
    lead_time_days: 10,
    monthly_capacity: 500,
    demand_score: 89,
    description: "Handcrafted gemstone ring with quality setting.",
  },

  // Handmade Toys & Dolls (6 products)
  {
    id: 43,
    title: "Wooden Puzzle Toy",
    craft_type: "Handmade Toys & Dolls",
    location_city: "Bangalore",
    price: 380,
    lead_time_days: 6,
    monthly_capacity: 1200,
    demand_score: 84,
    description: "Educational wooden puzzle toy for child development.",
  },
  {
    id: 44,
    title: "Handmade Cloth Doll",
    craft_type: "Handmade Toys & Dolls",
    location_city: "Kolkata",
    price: 520,
    lead_time_days: 7,
    monthly_capacity: 950,
    demand_score: 86,
    description: "Soft and safe handmade cloth doll for children.",
  },
  {
    id: 45,
    title: "Wooden Train Set",
    craft_type: "Handmade Toys & Dolls",
    location_city: "Bangalore",
    price: 890,
    lead_time_days: 9,
    monthly_capacity: 700,
    demand_score: 87,
    description: "Charming wooden train set with natural finishes.",
  },
  {
    id: 46,
    title: "Handcrafted Marionette Doll",
    craft_type: "Handmade Toys & Dolls",
    location_city: "Kolkata",
    price: 1200,
    lead_time_days: 11,
    monthly_capacity: 500,
    demand_score: 85,
    description: "Traditional handcrafted marionette doll for puppet shows.",
  },
  {
    id: 47,
    title: "Clay Figurine Set",
    craft_type: "Handmade Toys & Dolls",
    location_city: "Jaipur",
    price: 650,
    lead_time_days: 8,
    monthly_capacity: 800,
    demand_score: 83,
    description: "Colorful handmade clay figurine set for kids.",
  },
  {
    id: 48,
    title: "Wooden Building Blocks",
    craft_type: "Handmade Toys & Dolls",
    location_city: "Bangalore",
    price: 720,
    lead_time_days: 7,
    monthly_capacity: 900,
    demand_score: 86,
    description: "High-quality wooden building blocks for creative play.",
  },

  // Folk Art & Wall Decor (6 products)
  {
    id: 49,
    title: "Hand-Painted Wall Mural",
    craft_type: "Folk Art & Wall Decor",
    location_city: "Rajasthan",
    price: 2800,
    lead_time_days: 16,
    monthly_capacity: 200,
    demand_score: 91,
    description: "Authentic hand-painted folk art mural for interior spaces.",
  },
  {
    id: 50,
    title: "Madhubani Art Painting",
    craft_type: "Folk Art & Wall Decor",
    location_city: "Madhubani",
    price: 1400,
    lead_time_days: 12,
    monthly_capacity: 400,
    demand_score: 88,
    description: "Traditional Madhubani art painting with cultural heritage.",
  },
  {
    id: 51,
    title: "Warli Art Wall Hanging",
    craft_type: "Folk Art & Wall Decor",
    location_city: "Maharashtra",
    price: 980,
    lead_time_days: 9,
    monthly_capacity: 650,
    demand_score: 86,
    description: "Authentic Warli art wall hanging with tribal designs.",
  },
  {
    id: 52,
    title: "Hand-Painted Wooden Door",
    craft_type: "Folk Art & Wall Decor",
    location_city: "Rajasthan",
    price: 3600,
    lead_time_days: 18,
    monthly_capacity: 150,
    demand_score: 89,
    description: "Exquisite hand-painted wooden door with folk motifs.",
  },
  {
    id: 53,
    title: "Tanjore Gold Foil Painting",
    craft_type: "Folk Art & Wall Decor",
    location_city: "Tamil Nadu",
    price: 1800,
    lead_time_days: 11,
    monthly_capacity: 400,
    demand_score: 90,
    description: "Magnificent Tanjore painting with traditional gold foil.",
  },
  {
    id: 54,
    title: "Pichwai Art Canvas",
    craft_type: "Folk Art & Wall Decor",
    location_city: "Rajasthan",
    price: 1600,
    lead_time_days: 10,
    monthly_capacity: 450,
    demand_score: 87,
    description: "Beautiful Pichwai art canvas with religious traditional designs.",
  },
];

export const getProductImage = (productId) => {
  const imageMap = {
    // Bamboo & Cane Crafts
    1: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlekjuDofgaoLLwY8GO_JOOpFF1D67oRKdSSlZAZ5AHnRoB7TmAmPWqAM&s=10",
    2: "https://www.jiangnansourcing.com/cdn/shop/files/il_570xN.3019851767_sn7r.jpg?v=1764951943&width=533",
    3: "https://www.soiled.in/cdn/shop/files/Noor_Cane_Seating_Stool_Double2.png?v=1782352883&width=1024",
    4: "https://bosita.in/cdn/shop/files/81Ey-L-_zbL._AC_SX679.jpg?v=1742361705&width=4096",
    5: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPQtYKkvSFZ9A5sf0yuURuK5CNw1H3AokZYxhk9vkexYiruW1anLN2lcg&s=10",
    6: "https://rukminim3.flixcart.com/image/480/640/xif0q/storage-basket/g/i/t/1-small-picnic-basket-10x7-inch-aleena-creations-enriched-0-original-imahg85mvechwqkg.jpeg?q=20",

    // Handloom & Textiles
    7: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQR0AdRMXOWp6pLvwhvlBiQjs7Oqq4Gm8pYqUwH9Uor0w&s",
    8: "https://m.media-amazon.com/images/I/81trXaliNjL._AC_UF894,1000_QL80_.jpg",
    9: "https://ramrajcotton.in/cdn/shop/files/05_2508d798-aef5-4886-8b20-e800bac72f05.jpg?v=1777360562",
    10: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvTIxF7XFwiGsT5-tY2A-2wRKjgkOtGJ9xRm5lvGQCrkxTOlvlUMTAliLO&s=10",
    11: "https://m.media-amazon.com/images/I/81qyJsqd5sL._AC_UF894,1000_QL80_.jpg",
    12: "https://www.topfabric.co.uk/media/catalog/product/cache/af1c1a9bd0be5a4d2b4d4872501aabd8/1/5/15821_teal_cotton_silk_duchess_satin_5_1_1.jpg",

    // Pottery & Terracotta
    13: "https://www.zwende.com/cdn/shop/files/THE-HANDICRAFTIAN-DIYA-4.jpg?v=1728319101&width=1080",
    14: "https://m.media-amazon.com/images/I/41qcYJy9BQL._AC_UF894,1000_QL80_.jpg",
    15: "https://gardenup.in/cdn/shop/files/Zz.jpg?v=1712597553",
    16: "https://www.earthstore.in/cdn/shop/files/65165.webp?crop=center&height=800&v=1781162036&width=800",
    17: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuW1AaWnAVyhomzRWtKCEssaDTN5xqhQnKdM5PneIreVpcR76DNNINVHU&s=10",
    18: "https://i.etsystatic.com/43932260/r/il/959c52/5347755210/il_fullxfull.5347755210_nt4i.jpg",

    // Wood Crafts
    19: "https://rukminim2.flixcart.com/image/480/640/xif0q/serving-set/g/g/i/0020-natriel-original-imahmrh2z9xrnvsb.jpeg?q=80",
    20: "https://www.craftivaart.com/cdn/shop/collections/Wall-Art-Wall-panel-CraftivaArt-421_7de55698-e6fc-4351-b0f7-5b0b1670b9fc.jpg?v=1753456299",
    21: "https://m.media-amazon.com/images/I/41w+IdZEDWL._AC_UF894,1000_QL80_.jpg",
    22: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ59euFO4P9J1FzU4AsFk2hFT7x5iqvdMw8xlU9LNmmIQ&s=10",
    23: "https://m.media-amazon.com/images/I/717-2TKJFGL.jpg",
    24: "https://i.pinimg.com/474x/42/c9/b4/42c9b4cba774a792735ce1263dfa1bff.jpg",

    // Embroidery & Textiles
    25: "https://images.woodenstreet.de/image/cache/data/eyda/embroidered-cotton-cushion-covers-set-of-2-orange18-x-18-inch/30-5/20-750x650.jpg",
    26: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTnXe1LD199w10eVDWyBn4tw59VSg4voVXPK0s6Z3feJd8uTJEvJgllPPGW&s=10",
    27: "https://m.media-amazon.com/images/I/81PxA8BUxTL.jpg",
    28: "https://i.etsystatic.com/24975988/r/il/d4c050/4844574745/il_fullxfull.4844574745_9ssc.jpg",
    29: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLOQdnTdVQ4vxkNBTX05XygzV70hbNN01EfH_8UruWMjKB-V8EaSDy0YY&s=10",
    30: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSqxSLwf3TxI_7iJVohaU76srDH57PBe4hmMQRtmk5zcSPxoilnEI8IL_d&s=10",

    // Handmade Bags & Accessories
    31: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSBe9zkrmnTzlf2CXmlkq6AfiPMmnHzrVDH4oyQOEANBLmGWpmudCt6ZoE&s=10",
    32: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTPLECa2QKhLUdNZaK6ptTA4_27vOo6RSmsx-ZVwgOo8ajJgobIwmsP7f8&s=10",
    33: "https://i.etsystatic.com/47814361/r/il/134a48/7792354476/il_fullxfull.7792354476_3d82.jpg",
    34: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGyhspFx4Tf8jQbqmUb4y_WXwQh-C7ffrPySn0SNIeUv1011lWgM7pnZPi&s=10",
    35: "https://brownliving.in/cdn/shop/files/yildiz-wicker-tote-bag-handwoven-natural-wicker-shoulder-bag-427wd-ardpure-4205468.jpg?v=1766555708&width=1080",
    36: "https://kinnoti.com/cdn/shop/files/kinnoti-laptop-bags-coffee-brown-dufter-vegan-leather-laptop-bag-1217348471.jpg?v=1768913417&width=3000",

    // Handmade Jewellery
    37: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzdLoMSqTMv8pbmgGrCWBks9JHXdnZSE5vK7SikYtbYd5-D5jMu2mdDN_z&s=10",
    38: "https://cdn.shopaccino.com/nakhrali/products/22-889373630515677_l.jpg?v=732",
    39: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTUrqngLttL1MQ1vJhYDCVVMSbdCkKdcsXQymquDH8ITSw8QppboIlVeU6V&s=10",
    40: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRxOW6GqMBWGCiiHE_jvAY5JcxkAWYLZaeRmjHG2DUaTg&s",
    41: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSawb7fcQNTkYYkTRR-WXyqNC461fGuveDtJFQZ5O-8-THiEUf4iCbcKbcm&s=10",
    42: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyOzMJGD7ZXnT-H-Pi4KAH1qhRODnUfAyuQIAqOkAWXhRhBenwH6eBFVc&s=10",

    // Handmade Toys & Dolls
    43: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTc6HK8Aerfn1OQflT3pKfSdTeYoxq_IBXvzA4s6sKy7B4CuHi1TpN3x5c&s=10",
    44: "https://i.etsystatic.com/11234485/r/il/e240c8/3436798109/il_570xN.3436798109_sjh0.jpg",
    45: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTzljWe6oY424v_gdUV8IfOYZjeG7DCiLA5hB0zsv77RuMl_CtOwvL7E-f&s=10",
    46: "https://images-na.ssl-images-amazon.com/images/I/61eEee9hT7L._AC_UL495_SR435,495_.jpg",
    47: "https://m.media-amazon.com/images/I/71wVNZxB7QL._AC_UF894,1000_QL80_.jpg",
    48: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJ9WDKW8dI51YbK6l87TfxJWVUSXIc2aMOvInmeCqKtuFLWlPkerU81Wc&s=10",

    // Folk Art & Wall Decor
    49: "https://i.etsystatic.com/18000923/r/il/70ad51/1643214343/il_570xN.1643214343_dx4c.jpg",
    50: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9HtxMHmm1050CUBlJTN5cktKQhTRIu15ZT0Vv7SU9tOX5piitP5g5Abg&s=10",
    51: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRdYt76ct7Je62bs5M8C04HZOFPJBCJJRSbnDQmXzlgrCpkIVAEhuR2maY&s=10",
    52: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYt4RlRtjAJ1SB-xcFZ6Zy9KALOw2BDfZ56NAAZnr94jHZ5eoNVtPLmkfM&s=10",
    53: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQi0z3y3HK9zMvbcJKmk-2Mw5chU_b6duigNib9tGGosVaXY4lHDMzf-9Q5&s=10",
    54: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMI7OU8xLaRHh4viXM091T3F1CCmUTAbFj0SS_SXsVIJsg8epuCDMZKA8&s=10",
  };
  
  // First check if product is an artisan added item in SAMPLE_PRODUCTS with a custom image
  if (Array.isArray(SAMPLE_PRODUCTS)) {
    const prod = SAMPLE_PRODUCTS.find(p => String(p.id) === String(productId));
    if (prod && (prod.imageUrl || prod.image_url)) {
      return prod.imageUrl || prod.image_url;
    }
  }

  const photoId = imageMap[productId] || "photo-1524504388940-b1c1722653e1";
  
  // Check if it's a full URL or Unsplash ID
  if (typeof photoId === 'string' && photoId.startsWith('http')) {
    return photoId;
  }
  
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=900&q=80`;
};

/**
 * Maps any artisan craft string to the matching buyer CRAFT_CATEGORIES name
 */
export function mapCraftToBuyerCategory(craftName) {
  if (!craftName) return 'Bamboo & Cane Crafts';
  const c = craftName.toLowerCase();
  if (c.includes('bamboo') || c.includes('cane')) return 'Bamboo & Cane Crafts';
  if (c.includes('pottery') || c.includes('terracotta') || c.includes('clay') || c.includes('stone') || c.includes('sculpture')) return 'Pottery & Terracotta';
  if (c.includes('handloom') || c.includes('weaving') || c.includes('textile') || c.includes('saree') || c.includes('silk') || c.includes('cotton') || c.includes('dhoti')) return 'Handloom & Textiles';
  if (c.includes('toy') || c.includes('doll') || c.includes('etikoppaka') || c.includes('kondapalli') || c.includes('channapatna')) return 'Handmade Toys & Dolls';
  if (c.includes('wood') || c.includes('carving')) return 'Wood Crafts';
  if (c.includes('embroidery') || c.includes('zardozi') || c.includes('mirror')) return 'Embroidery & Textiles';
  if (c.includes('bag') || c.includes('accessories') || c.includes('jute') || c.includes('pouch') || c.includes('clutch')) return 'Handmade Bags & Accessories';
  if (c.includes('jewel') || c.includes('metal') || c.includes('brass') || c.includes('dokra') || c.includes('bangle') || c.includes('earring') || c.includes('necklace')) return 'Handmade Jewellery';
  if (c.includes('folk') || c.includes('art') || c.includes('kalamkari') || c.includes('madhubani') || c.includes('cheriyal') || c.includes('warli') || c.includes('tanjore') || c.includes('paint') || c.includes('leather') || c.includes('puppetry')) return 'Folk Art & Wall Decor';
  return 'Bamboo & Cane Crafts';
}

/**
 * Determines whether a product is related to a specific craft.
 * Used to filter out products belonging to other crafts when an artisan changes craft.
 * @param {object} product
 * @param {string} craftName
 * @returns {boolean}
 */
export function isProductRelatedToCraft(product, craftName) {
  if (!product || !craftName) return false;

  const targetCategory = mapCraftToBuyerCategory(craftName);
  
  // Category of the product mapped to buyer category
  const rawCat = product.craft_type || product.category || product.displayCategory || '';
  const prodCategory = mapCraftToBuyerCategory(rawCat);

  // If raw category explicitly maps to buyer categories, check direct match
  if (prodCategory === targetCategory) {
    return true;
  }

  // Keywords mapping for deeper inspection (names, materials, tags)
  const keywordsMap = {
    'Bamboo & Cane Crafts': ['bamboo', 'cane', 'wicker', 'reed'],
    'Handloom & Textiles': ['handloom', 'textile', 'weaving', 'saree', 'silk', 'cotton', 'dupatta', 'dhoti', 'shawl', 'chanderi', 'banarasi', 'khadi', 'ikkat', 'ikat', 'fabric'],
    'Pottery & Terracotta': ['pottery', 'terracotta', 'clay', 'ceramic', 'pitcher', 'diya', 'vase', 'earthen', 'matka', 'kulhad', 'sculpture'],
    'Wood Crafts': ['wood', 'carving', 'wooden', 'teak', 'rosewood', 'timber', 'sheesham'],
    'Embroidery & Textiles': ['embroidery', 'embroidered', 'zardozi', 'needlework', 'kantha', 'chikankari', 'kasuti', 'phulkari'],
    'Handmade Bags & Accessories': ['bag', 'jute', 'tote', 'pouch', 'clutch', 'wallet', 'backpack', 'handbag'],
    'Handmade Jewellery': ['jewel', 'jewellery', 'jewelry', 'bangle', 'earring', 'necklace', 'metal', 'brass', 'dokra'],
    'Handmade Toys & Dolls': ['toy', 'doll', 'kondapalli', 'etikoppaka', 'channapatna', 'puppet'],
    'Folk Art & Wall Decor': ['folk art', 'kalamkari', 'madhubani', 'warli', 'cheriyal', 'tanjore', 'pichwai', 'pattachitra', 'canvas', 'wall decor', 'painting']
  };

  const text = `${product.name || ''} ${product.title || ''} ${rawCat} ${product.material || ''} ${(product.tags || []).join(' ')}`.toLowerCase();

  const targetKeywords = keywordsMap[targetCategory] || [];
  const hasTargetKeyword = targetKeywords.some(kw => text.includes(kw));

  if (!hasTargetKeyword) return false;

  // Make sure it doesn't clearly match another category's primary keywords instead
  for (const [otherCat, otherKws] of Object.entries(keywordsMap)) {
    if (otherCat !== targetCategory && prodCategory === otherCat) {
      return false;
    }
  }

  return true;
}

/**
 * Deduplicate SAMPLE_PRODUCTS in-place to guarantee zero repeated products in the buyer marketplace.
 */
export function deduplicateSampleProducts() {
  const seenIds = new Set();
  const seenTitles = new Set();
  const cleaned = [];

  for (const product of SAMPLE_PRODUCTS) {
    if (!product || product.id === undefined || !product.title) continue;
    const idKey = String(product.id).trim();
    const titleKey = product.title.trim().toLowerCase();

    // Preserve the first instance (custom artisan direct products are unshifted first)
    if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
      seenIds.add(idKey);
      seenTitles.add(titleKey);
      cleaned.push(product);
    }
  }

  SAMPLE_PRODUCTS.length = 0;
  SAMPLE_PRODUCTS.push(...cleaned);
}

/**
 * Returns buyer products matching an artisan's chosen craft with zero duplicates
 */
export function getBuyerProductsForCraft(craftName) {
  if (!craftName) return SAMPLE_PRODUCTS.slice(0, 6);
  const targetCategory = mapCraftToBuyerCategory(craftName);
  const c = craftName.toLowerCase();
  
  deduplicateSampleProducts();

  let matches = SAMPLE_PRODUCTS.filter(p => p.craft_type === targetCategory);

  // Deduplicate matches by normalized title
  const seen = new Set();
  matches = matches.filter(p => {
    const key = p.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // If specific craft like Kalamkari, prioritize matching title
  if (c.includes('kalamkari')) {
    const kalamkariItem = matches.find(p => (p.title || '').toLowerCase().includes('kalamkari'));
    if (kalamkariItem) {
      matches = [kalamkariItem, ...matches.filter(m => m.id !== kalamkariItem.id)];
    }
  } else if (c.includes('toy') || c.includes('etikoppaka') || c.includes('kondapalli')) {
    const toyItems = SAMPLE_PRODUCTS.filter(p => p.craft_type === 'Handmade Toys & Dolls');
    if (toyItems.length > 0) matches = toyItems;
  }

  if (matches.length > 0) return matches;
  return SAMPLE_PRODUCTS.slice(0, 6);
}

/**
 * Adds an artisan-created product to the buyer side marketplace catalog.
 * Guarantees NO duplicate titles or duplicate IDs in buyer side!
 */
export function addArtisanProductToBuyerMarketplace(artisanProduct, artisanUser = null) {
  if (!artisanProduct) return null;

  // Never duplicate buyer-seeded products in buyer marketplace!
  if (artisanProduct.catalogSource === 'buyer_catalog_seed' || artisanProduct.buyerProductId) {
    return null;
  }

  const buyerId = typeof artisanProduct.id === 'string' && artisanProduct.id.startsWith('PRD-') 
    ? artisanProduct.id 
    : `art-${artisanProduct.id || Date.now()}`;

  const categoryName = mapCraftToBuyerCategory(artisanProduct.category || artisanProduct.displayCategory);
  const cleanTitle = (artisanProduct.name || artisanProduct.title || 'Handcrafted Craft Product').trim();
  const normalizedTitle = cleanTitle.toLowerCase();

  const buyerProduct = {
    id: buyerId,
    title: cleanTitle,
    craft_type: categoryName,
    location_city: artisanProduct.location || (artisanUser?.location) || 'East Godavari, Andhra Pradesh',
    price: Number(artisanProduct.price) || 0,
    lead_time_days: Number(artisanProduct.productionTimeDays) || 7,
    monthly_capacity: Number(artisanProduct.productionCapacity) || 100,
    available_stock: Number(artisanProduct.availableQuantity) || 20,
    demand_score: 95,
    description: artisanProduct.description || 'Authentic handcrafted creation from local master artisan.',
    imageUrl: artisanProduct.imageUrl || '',
    image_url: artisanProduct.imageUrl || '',
    is_artisan_added: true,
    artisan_id: artisanProduct.artisanId || (artisanUser?.id) || 'artisan-current',
    artisan_name: (artisanUser?.name) || 'Verified Artisan'
  };

  // Remove any existing product with the same ID OR same normalized title to prevent duplicates
  for (let i = SAMPLE_PRODUCTS.length - 1; i >= 0; i--) {
    const p = SAMPLE_PRODUCTS[i];
    if (String(p.id) === String(buyerId) || p.title.trim().toLowerCase() === normalizedTitle) {
      SAMPLE_PRODUCTS.splice(i, 1);
    }
  }

  // Prepend so the newly added artisan product appears prominently at the top of the buyer marketplace
  SAMPLE_PRODUCTS.unshift(buyerProduct);
  deduplicateSampleProducts();
  saveArtisanMarketplaceProducts();
  document.dispatchEvent(new CustomEvent('artisan-product-added-to-marketplace', { detail: { product: buyerProduct } }));
  return buyerProduct;
}

/**
 * Updates an artisan product in buyer marketplace
 */
export function updateArtisanProductInBuyerMarketplace(artisanProduct) {
  if (!artisanProduct) return;
  const targetId = String(artisanProduct.id);
  const idx = SAMPLE_PRODUCTS.findIndex(p => String(p.id) === targetId);
  if (idx !== -1) {
    SAMPLE_PRODUCTS[idx] = {
      ...SAMPLE_PRODUCTS[idx],
      title: (artisanProduct.name || SAMPLE_PRODUCTS[idx].title).trim(),
      price: Number(artisanProduct.price) || SAMPLE_PRODUCTS[idx].price,
      lead_time_days: Number(artisanProduct.productionTimeDays) || SAMPLE_PRODUCTS[idx].lead_time_days,
      monthly_capacity: Number(artisanProduct.productionCapacity) || SAMPLE_PRODUCTS[idx].monthly_capacity,
      available_stock: Number(artisanProduct.availableQuantity) || SAMPLE_PRODUCTS[idx].available_stock,
      description: artisanProduct.description || SAMPLE_PRODUCTS[idx].description,
      imageUrl: artisanProduct.imageUrl || SAMPLE_PRODUCTS[idx].imageUrl,
      image_url: artisanProduct.imageUrl || SAMPLE_PRODUCTS[idx].image_url
    };
    deduplicateSampleProducts();
    saveArtisanMarketplaceProducts();
    document.dispatchEvent(new CustomEvent('artisan-product-updated-in-marketplace', { detail: { product: SAMPLE_PRODUCTS[idx] } }));
  } else {
    addArtisanProductToBuyerMarketplace(artisanProduct);
  }
}

/**
 * Removes an artisan product from buyer marketplace
 */
export function removeArtisanProductFromBuyerMarketplace(productId) {
  const targetId = String(productId);
  const idx = SAMPLE_PRODUCTS.findIndex(p => String(p.id) === targetId);
  if (idx !== -1) {
    SAMPLE_PRODUCTS.splice(idx, 1);
    deduplicateSampleProducts();
    saveArtisanMarketplaceProducts();
    document.dispatchEvent(new CustomEvent('artisan-product-removed-from-marketplace', { detail: { productId: targetId } }));
  }
}

function saveArtisanMarketplaceProducts() {
  try {
    const customOnly = SAMPLE_PRODUCTS.filter(p => p.is_artisan_added);
    localStorage.setItem('kala_mitra_artisan_marketplace_products', JSON.stringify(customOnly));
  } catch (e) {
    console.warn('Failed to save artisan products to localStorage:', e);
  }
}

export function loadStoredArtisanMarketplaceProducts() {
  try {
    const raw = localStorage.getItem('kala_mitra_artisan_marketplace_products');
    if (raw) {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        // Base titles from standard catalog (numeric IDs 1 to 54)
        const baseTitles = new Set(
          SAMPLE_PRODUCTS.filter(p => typeof p.id === 'number' || !p.is_artisan_added).map(p => p.title.trim().toLowerCase())
        );

        // Filter out legacy corrupted items (seeds saved as artisan added with base titles)
        const validCustomItems = items.filter(item => {
          if (!item || !item.title) return false;
          const isBaseTitle = baseTitles.has(item.title.trim().toLowerCase());
          const isSeedId = typeof item.id === 'string' && item.id.startsWith('PRD-') && !item.id.startsWith('PRD-custom');
          // If it matches a base product title, drop it
          if (isBaseTitle && isSeedId) return false;
          return true;
        });

        validCustomItems.forEach(item => {
          if (!SAMPLE_PRODUCTS.some(p => String(p.id) === String(item.id) || p.title.trim().toLowerCase() === item.title.trim().toLowerCase())) {
            SAMPLE_PRODUCTS.unshift(item);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load artisan products from localStorage:', e);
  }
  deduplicateSampleProducts();
}

export function syncAllArtisanProductsToBuyerMarketplace(artisanProductsList, artisanUser = null) {
  if (!Array.isArray(artisanProductsList)) return;

  const currentIds = new Set(artisanProductsList.map(p => String(p.id)));
  const artisanId = artisanUser?.id || 'art_current';

  // Clean up any previously added artisan products that are no longer in the artisan's list
  for (let i = SAMPLE_PRODUCTS.length - 1; i >= 0; i--) {
    const sp = SAMPLE_PRODUCTS[i];
    if (sp.is_artisan_added && (sp.artisan_id === artisanId || sp.artisan_id === 'artisan-current' || sp.artisan_id === 'art_current')) {
      if (!currentIds.has(String(sp.id))) {
        SAMPLE_PRODUCTS.splice(i, 1);
      }
    }
  }

  // ONLY sync genuine custom artisan products (NEVER seeded products!)
  artisanProductsList.forEach(artisanProduct => {
    const isCustom = artisanProduct.catalogSource === 'manual' || 
                     artisanProduct.aiGenerated || 
                     (!artisanProduct.buyerProductId && artisanProduct.catalogSource !== 'buyer_catalog_seed');
    
    if (isCustom && (artisanProduct.status === 'active' || !artisanProduct.status)) {
      addArtisanProductToBuyerMarketplace(artisanProduct, artisanUser);
    }
  });

  deduplicateSampleProducts();
  saveArtisanMarketplaceProducts();
}

// Auto-hydrate saved artisan products on load
loadStoredArtisanMarketplaceProducts();

