const fs = require('node:fs');
const path = require('node:path');

// Klasör yolu
const dbDir = path.join(__dirname, '..', 'database');

// Eğer database klasörü yoksa oluştur
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

class Database {
    constructor(fileName) {
        this.dbPath = path.join(dbDir, fileName);
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({}, null, 4), 'utf8');
        }
    }

    readDB() {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
    }

    writeDB(data) {
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 4), 'utf8');
    }

    bul(key) {
        const db = this.readDB();
        return db[key] !== undefined ? db[key] : null;
    }

    ayarla(key, value) {
        const db = this.readDB();
        db[key] = value;
        this.writeDB(db);
        return db[key];
    }

    yaz(key, value) {
        return this.ayarla(key, value);
    }

    ekle(key, amount) {
        const db = this.readDB();
        if (!db[key]) db[key] = 0;
        db[key] += amount;
        this.writeDB(db);
        return db[key];
    }

    cikar(key, amount) {
        const db = this.readDB();
        if (!db[key]) db[key] = 0;
        db[key] -= amount;
        this.writeDB(db);
        return db[key];
    }

    sil(key) {
        const db = this.readDB();
        if (db[key] !== undefined) {
            delete db[key];
            this.writeDB(db);
            return true;
        }
        return false;
    }
}

// Artık sadece tek bir dosya yerine farklı kategoriler için veritabanları sunuyoruz
module.exports = {
    ecoDb: new Database('economy.json'),
    cooldownDb: new Database('cooldowns.json'),
    userDb: new Database('users.json')
};
