const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags,
    SectionBuilder,
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { ecoDb, userDb } = require('../utils/db');
const { ekleTilsim } = require('../utils/tilsimUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mağaza')
        .setDescription('Mağazayı görüntüler ve anında satın alım yapmanızı sağlar.'),
        
    async execute(interaction) {
        const shopPath = path.join(__dirname, '..', 'config', 'shop.json');
        const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

        const MAX_ESYA = 5;

        // Kategorilerin temel bilgileri
        const kategoriBilgileri = {
            'meslekler': { baslik: 'Meslek Rolleri', emoji: '💼', renk: 0x3498db, veriler: shopData.meslekler },
            'yatirimlar': { baslik: 'Yatırımlar', emoji: '📈', renk: 0xe67e22, veriler: shopData.yatirimlar },
            'tilsimlar': { baslik: 'Büyülü Tılsımlar', emoji: '🧿', renk: 0x1abc9c, veriler: shopData.tilsimlar || [] },
            'roller': { baslik: 'Sunucu Rolleri', emoji: '🎭', renk: 0x9b59b6, veriler: shopData.roller },
            'yuzukler': { baslik: 'Evlilik Yüzükleri', emoji: '💍', renk: 0xff6b81, veriler: shopData.yuzukler || [] }
        };

        let aktifKategori = 'meslekler';
        let aktifSayfa = 0;

        const generateContainer = (katId, sayfaIndex) => {
            const kategori = kategoriBilgileri[katId];
            const toplamEsya = kategori.veriler.length;
            const toplamSayfa = Math.ceil(toplamEsya / MAX_ESYA) || 1;
            
            // Güvenlik önlemi (eğer sayfa indeksi sınırları aşarsa düzelt)
            if (sayfaIndex >= toplamSayfa) sayfaIndex = toplamSayfa - 1;
            if (sayfaIndex < 0) sayfaIndex = 0;

            const baslangic = sayfaIndex * MAX_ESYA;
            const gosterilecekVeriler = kategori.veriler.slice(baslangic, baslangic + MAX_ESYA);

            const container = new ContainerBuilder().setAccentColor(kategori.renk);

            // Başlık
            const sayfaYazisi = toplamSayfa > 1 ? ` (Sayfa ${sayfaIndex + 1}/${toplamSayfa})` : '';
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${kategori.emoji} Mağaza: ${kategori.baslik}${sayfaYazisi}`)
            );
            
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            if (gosterilecekVeriler.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('*Bu kategoride şu an ürün bulunmuyor.*'));
            } else {
                for (const urun of gosterilecekVeriler) {
                    const satinAlButonu = new ButtonBuilder()
                        .setCustomId(`buy#${urun.id}#${katId}`)
                        .setLabel(`${urun.fiyat.toLocaleString()} 🪙`)
                        .setStyle(ButtonStyle.Success);

                    let detay = urun.aciklama;
                    if (urun.bonusYuzdesi) detay += `\n*(Maaş Bonusu: +%${urun.bonusYuzdesi})*`;
                    if (urun.saatlikGelir) detay += `\n*(Pasif Gelir: ${urun.saatlikGelir.toLocaleString()} 🪙/saat)*`;

                    const section = new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`**${urun.isim}**`),
                            new TextDisplayBuilder().setContent(detay)
                        )
                        .setButtonAccessory(satinAlButonu);

                    container.addSectionComponents(section);
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                }
            }

            // 1. Action Row: Kategori İçi Sayfa Değiştirme Butonları
            const butonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('onceki')
                    .setLabel('◀ Önceki')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(sayfaIndex === 0),
                new ButtonBuilder()
                    .setCustomId('sayfa_bilgisi')
                    .setLabel(`Sayfa: ${sayfaIndex + 1} / ${toplamSayfa}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('sonraki')
                    .setLabel('Sonraki ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(sayfaIndex >= toplamSayfa - 1)
            );

            // 2. Action Row: Kategoriler Arası Geçiş Menüsü
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('kategori_secim')
                .setPlaceholder('Farklı bir kategori seçin...');

            for (const [key, val] of Object.entries(kategoriBilgileri)) {
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(val.baslik)
                        .setValue(key)
                        .setEmoji(val.emoji)
                        .setDefault(key === katId)
                );
            }

            const menuRow = new ActionRowBuilder().addComponents(selectMenu);
            
            // Container'a butonları ve menüyü ekle
            container.addActionRowComponents(butonRow);
            container.addActionRowComponents(menuRow);
            
            return container;
        };

        const response = await interaction.reply({ 
            components: [generateContainer(aktifKategori, aktifSayfa)], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu menüyü sadece komutu yazan kişi kullanabilir!', flags: MessageFlags.Ephemeral });
            }

            // Kategori Menüsü Değiştiyse
            if (i.isStringSelectMenu() && i.customId === 'kategori_secim') {
                aktifKategori = i.values[0];
                aktifSayfa = 0; // Yeni kategoriye geçince ilk sayfaya dön
                await i.update({ components: [generateContainer(aktifKategori, aktifSayfa)], flags: MessageFlags.IsComponentsV2 });
            } 
            // Kategori İçinde Sayfa Butonlarına Tıklandıysa
            else if (i.isButton()) {
                if (i.customId === 'onceki') {
                    aktifSayfa--;
                    await i.update({ components: [generateContainer(aktifKategori, aktifSayfa)], flags: MessageFlags.IsComponentsV2 });
                } else if (i.customId === 'sonraki') {
                    aktifSayfa++;
                    await i.update({ components: [generateContainer(aktifKategori, aktifSayfa)], flags: MessageFlags.IsComponentsV2 });
                } else if (i.customId.startsWith('buy#')) {
                    // Satın alma işlemi
                    const parcalar = i.customId.split('#');
                    const urunId = parcalar[1];
                    const kategoriId = parcalar[2];
                    const userId = i.user.id;

                    const kategoriVerisi = shopData[kategoriId];
                    const urun = kategoriVerisi.find(u => u.id === urunId);

                    if (!urun) return i.reply({ content: 'Ürün bulunamadı!', flags: MessageFlags.Ephemeral });

                    const cuzdanParasi = ecoDb.bul(`cuzdan_${userId}`) || 0;

                    if (cuzdanParasi < urun.fiyat) {
                        return i.reply({ content: `❌ Yetersiz bakiye! Bu ürünü almak için **${urun.fiyat.toLocaleString()} 🪙** bakiyeniz olmalı.`, flags: MessageFlags.Ephemeral });
                    }

                    let envanter = userDb.bul(`envanter_${userId}`) || [];
                    
                    // Tılsımlar kalıcı envantere girmez, aktif tılsım olarak eklenir ve süresi biter
                    if (kategoriId === 'tilsimlar') {
                        ecoDb.cikar(`cuzdan_${userId}`, urun.fiyat);
                        ekleTilsim(userId, urun);
                        return i.reply({
                            content: `✅ Başarılı! **${urun.fiyat.toLocaleString()} 🪙** ödeyerek **${urun.emoji} ${urun.isim}** satın aldınız!\n✨ *Tılsım anında aktifleşti. Süresi: ${urun.sureSaat} Saat.*`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (envanter.some(e => e.id === urun.id)) {
                        return i.reply({ content: `❌ Zaten **${urun.isim}** ürününe sahipsiniz!`, flags: MessageFlags.Ephemeral });
                    }

                    // Meslekler için sırasıyla terfi (progression) sistemi
                    if (kategoriId === 'meslekler') {
                        const hedefIndex = kategoriVerisi.findIndex(u => u.id === urunId);
                        const mevcutMeslek = envanter.find(e => e.kategori === 'meslekler');

                        // Eğer zaten bu mesleğe sahipse
                        if (mevcutMeslek && mevcutMeslek.id === urunId) {
                            return i.reply({ content: `❌ Zaten **${urun.isim}** mesleğindesiniz!`, flags: MessageFlags.Ephemeral });
                        }

                        // Eğer oyuncu daha alt seviye bir meslek almaya çalışıyorsa engelle
                        if (mevcutMeslek) {
                            const mevcutIndex = kategoriVerisi.findIndex(u => u.id === mevcutMeslek.id);
                            if (hedefIndex < mevcutIndex) {
                                return i.reply({ 
                                    content: `❌ Şu anki mesleğiniz (**${mevcutMeslek.isim}**), almak istediğiniz meslekten (**${urun.isim}**) daha üst seviyede! Rütbe düşüremezsiniz.`, 
                                    flags: MessageFlags.Ephemeral 
                                });
                            }
                        }

                        if (hedefIndex > 0) {
                            const gerekenMeslek = kategoriVerisi[hedefIndex - 1];
                            if (!mevcutMeslek || mevcutMeslek.id !== gerekenMeslek.id) {
                                return i.reply({ content: `❌ Bu mesleğe terfi edebilmek için önce **${gerekenMeslek.isim}** olarak çalışmalısın!`, flags: MessageFlags.Ephemeral });
                            }
                        }
                    }

                    // Sadece cüzdandan kes
                    ecoDb.cikar(`cuzdan_${userId}`, urun.fiyat);

                    let ekstraMesaj = '';
                    if (kategoriId === 'meslekler') {
                        const eskiMeslek = envanter.find(e => e.kategori === 'meslekler');
                        if (eskiMeslek) {
                            envanter = envanter.filter(e => e.kategori !== 'meslekler');
                            ekstraMesaj = `\n*(Eski mesleğiniz olan **${eskiMeslek.isim}** bırakıldı ve terfi ettiniz! Eski tecrübeleriniz silindi, Kariyer Seviyeniz 1'e düştü.)*`;
                        } else {
                            ekstraMesaj = `\n*(Kariyerinize ilk adımı attınız!)*`;
                        }
                        // Yeni mesleğe geçildiği için XP'yi sıfırla
                        userDb.ayarla(`xp_${userId}`, 0);
                    }

                    envanter.push({ 
                        id: urun.id, 
                        isim: urun.isim, 
                        kategori: kategoriId, 
                        bonusYuzdesi: urun.bonusYuzdesi,
                        seviye: kategoriId === 'yatirimlar' ? 1 : undefined
                    });
                    userDb.ayarla(`envanter_${userId}`, envanter);

                    if (kategoriId === 'roller' && urun.roleId) {
                        try {
                            const rol = interaction.guild.roles.cache.get(urun.roleId);
                            if (rol) await interaction.member.roles.add(rol);
                        } catch (error) {
                            console.error('Rol verme hatası:', error);
                        }
                    }

                    await i.reply({ content: `✅ Başarılı! **${urun.fiyat.toLocaleString()} 🪙** ödeyerek **${urun.isim}** satın aldınız.${ekstraMesaj}`, flags: MessageFlags.Ephemeral });
                }
            }
        });
    },
};
