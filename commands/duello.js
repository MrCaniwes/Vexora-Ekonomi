const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ecoDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('düello')
        .setDescription('Bota veya başka bir oyuncuya karşı sıra tabanlı dövüş yapın!')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Ortaya konacak bahis miktarı')
                .setRequired(true)
        )
        .addUserOption(option => 
            option.setName('rakip')
                .setDescription('Meydan okumak istediğiniz kullanıcı (Boş bırakırsanız bota karşı oynarsınız)')
                .setRequired(false)
        ),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        let bahis = interaction.options.getInteger('bahis');
        const rakipKullanici = interaction.options.getUser('rakip');

        // Prefix desteği
        if (!bahis && interaction.options.getString('bahis')) {
            bahis = parseInt(interaction.options.getString('bahis'));
        }

        if (!bahis || isNaN(bahis) || bahis <= 0) {
            return interaction.reply({ content: 'Lütfen geçerli bir bahis miktarı girin.', flags: MessageFlags.Ephemeral });
        }

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        const isPvE = !rakipKullanici || rakipKullanici.bot || rakipKullanici.id === userId;
        
        let p1 = { id: userId, name: interaction.user.displayName, hp: 100, shield: false, maxHp: 100 };
        let p2 = { id: isPvE ? 'BOT' : rakipKullanici.id, name: isPvE ? 'Vexora Bot' : rakipKullanici.displayName, hp: 100, shield: false, maxHp: 100 };

        if (!isPvE) {
            const rakipCuzdan = ecoDb.bul(`cuzdan_${p2.id}`) || 0;
            if (rakipCuzdan < bahis) {
                return interaction.reply({ content: `❌ Rakibinizin (${p2.name}) yeterli bakiyesi yok! En az **${bahis.toLocaleString()} 🪙** parası olmalı.`, flags: MessageFlags.Ephemeral });
            }

            // PvP Davet Mesajı
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kabul').setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('reddet').setLabel('Reddet').setStyle(ButtonStyle.Danger)
            );

            const davetRes = await interaction.reply({
                content: `⚔️ <@${p2.id}>, **${p1.name}** seni **${bahis.toLocaleString()} 🪙** bahsine düelloya davet ediyor!\nKabul ediyor musun?`,
                components: [row],
                withResponse: true
            });

            const davetMsg = davetRes.resource ? davetRes.resource.message : davetRes;
            
            // Promise tabanlı manuel collector oluşturuyoruz (awaitMessageComponent yerine)
            const kabulSüreci = new Promise((resolve, reject) => {
                const davetCollector = davetMsg.createMessageComponentCollector({ time: 30000 });
                
                davetCollector.on('collect', async i => {
                    if (i.user.id !== p2.id) {
                        return i.reply({ content: 'Bu düello daveti sana gelmedi!', flags: MessageFlags.Ephemeral });
                    }
                    
                    if (i.customId === 'reddet') {
                        davetCollector.stop('reddedildi');
                        await i.update({ content: `❌ ${p2.name} düelloyu reddetti.`, components: [] });
                        reject('reddedildi');
                    } else if (i.customId === 'kabul') {
                        davetCollector.stop('kabul');
                        ecoDb.cikar(`cuzdan_${p1.id}`, bahis);
                        ecoDb.cikar(`cuzdan_${p2.id}`, bahis);
                        await i.update({ content: `⚔️ Düello başlıyor!`, components: [] });
                        resolve();
                    }
                });

                davetCollector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        interaction.editReply({ content: `⏳ ${p2.name} zamanında cevap vermediği için düello iptal edildi.`, components: [] }).catch(()=>{});
                        reject('zaman_asimi');
                    }
                });
            });

            try {
                await kabulSüreci;
            } catch (err) {
                return; // Reddedildi veya zaman aşımına uğradı, fonksiyonu bitir.
            }
        } else {
            // PvE ise sadece P1'in parasını kesiyoruz, botun sınırsız parası var :)
            ecoDb.cikar(`cuzdan_${p1.id}`, bahis);
        }

        // Oyun State
        let siradaki = p1.id;
        let oyunBitti = false;
        let loglar = ['⚔️ Düello Başladı! İlk hamle senin.'];

        const hasarVur = (saldiran, savunan, tip) => {
            let hamleLog = '';
            let hasar = 0;
            let isabetSansi = Math.random();

            if (tip === 'saldiri') {
                if (isabetSansi < 0.15) {
                    hamleLog = `💨 **${saldiran.name}** saldırdı ama ıska geçti!`;
                } else {
                    hasar = Math.floor(Math.random() * (25 - 12 + 1)) + 12; // 12 - 25
                    hamleLog = `🗡️ **${saldiran.name}** kılıcını savurdu!`;
                }
            } else if (tip === 'ulti') {
                if (isabetSansi < 0.80) {
                    hamleLog = `✨ **${saldiran.name}** büyük bir Ulti hazırladı ama ıskaladı! Yere düştü!`;
                } else {
                    hasar = Math.floor(Math.random() * (55 - 40 + 1)) + 40; // 40 - 55
                    hamleLog = `💥 **${saldiran.name}** KUSURSUZ BİR ULTİ ATTI!`;
                }
            } else if (tip === 'kalkan') {
                saldiran.shield = true;
                hamleLog = `🛡️ **${saldiran.name}** savunma pozisyonuna geçti! Bir sonraki hasarı büyük ölçüde emecek.`;
                return hamleLog; // kalkan hasar vurmaz
            }

            if (hasar > 0) {
                if (savunan.shield) {
                    const engellenen = Math.floor(hasar * 0.70); // %70 blok
                    hasar -= engellenen;
                    savunan.shield = false; // kalkan kırıldı
                    hamleLog += ` (Kalkan ${engellenen} hasarı emdi!)`;
                }
                savunan.hp -= hasar;
                if (savunan.hp < 0) savunan.hp = 0;
                hamleLog += ` **-${hasar} HP**`;
            }

            return hamleLog;
        };

        const renderUI = () => {
            const container = new ContainerBuilder().setAccentColor(0x3498db);

            let header = `### ⚔️ ARENA DÜELLOSU\n**Ortadaki Ödül:** ${(isPvE ? bahis * 2 : bahis * 2).toLocaleString()} 🪙\n\n`;
            
            const bar = (hp) => {
                const dolu = Math.max(0, Math.ceil(hp / 10));
                const bos = 10 - dolu;
                return '🟩'.repeat(dolu) + '⬛'.repeat(bos);
            };

            const p1Durum = p1.shield ? '🛡️' : '';
            const p2Durum = p2.shield ? '🛡️' : '';

            header += `**${p1.name}** ${p1Durum}\n${bar(p1.hp)} **${p1.hp} HP**\n\n`;
            header += `**${p2.name}** ${p2Durum}\n${bar(p2.hp)} **${p2.hp} HP**\n\n`;

            header += `> ${loglar.slice(-2).join('\n> ')}`; // Son 2 logu göster

            if (oyunBitti) {
                let bitisLog = '';
                let kazananP = p1.hp > 0 ? p1 : (p2.hp > 0 ? p2 : null);
                
                if (kazananP) {
                    bitisLog = `\n\n🎉 **KAZANAN:** ${kazananP.name}!\n(+${(bahis * 2).toLocaleString()} 🪙)`;
                    // Ödül dağıtımı
                    if (kazananP.id !== 'BOT') {
                        ecoDb.ekle(`cuzdan_${kazananP.id}`, bahis * 2);
                    }
                } else {
                    bitisLog = `\n\n🤝 **BERABERE!** İki taraf da aynı anda yere yığıldı.`;
                    ecoDb.ekle(`cuzdan_${p1.id}`, bahis);
                    if (!isPvE) ecoDb.ekle(`cuzdan_${p2.id}`, bahis);
                }
                
                const gB = ecoDb.bul(`cuzdan_${userId}`) || 0;
                bitisLog += `\n*Güncel Bakiye: ${gB.toLocaleString()} 🪙*`;

                header += bitisLog;
                container.setAccentColor(0xf1c40f);
            } else {
                header += `\n\n⏳ Sıra: **${siradaki === p1.id ? p1.name : p2.name}**`;
            }

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));

            if (!oyunBitti) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('saldiri').setLabel('Saldır (12-25)').setEmoji('🗡️').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('kalkan').setLabel('Kalkan (%70 Blok)').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ulti').setLabel('Ulti (40-55) [%20]').setEmoji('⚡').setStyle(ButtonStyle.Success)
                );
                container.addActionRowComponents(row);
            }

            return container;
        };

        const anaRes = isPvE 
            ? await interaction.reply({ components: [renderUI()], flags: MessageFlags.IsComponentsV2, withResponse: true }) 
            : await interaction.channel.send({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 });

        const msgObj = anaRes.resource ? anaRes.resource.message : anaRes;
        const collector = msgObj.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== siradaki) {
                return i.reply({ content: 'Sıra sende değil!', flags: MessageFlags.Ephemeral });
            }

            const aktifP = siradaki === p1.id ? p1 : p2;
            const hedefP = siradaki === p1.id ? p2 : p1;
            const secim = i.customId;

            // Oyuncu hamlesini yap
            loglar.push(hasarVur(aktifP, hedefP, secim));

            if (hedefP.hp <= 0 || aktifP.hp <= 0) {
                oyunBitti = true;
                collector.stop();
                return i.update({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 });
            }

            siradaki = hedefP.id;

            // Eğer PvE ise Bot'un hamlesi otomatik gelsin
            if (isPvE && siradaki === 'BOT') {
                // UI'ı önce bir anlık oyuncuya göster
                await i.update({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 });
                
                setTimeout(async () => {
                    const rnd = Math.random();
                    let botSecim = 'saldiri';
                    if (rnd < 0.20 && !p2.shield) botSecim = 'kalkan';
                    else if (rnd < 0.35) botSecim = 'ulti';

                    loglar.push(hasarVur(p2, p1, botSecim));

                    if (p1.hp <= 0 || p2.hp <= 0) {
                        oyunBitti = true;
                        collector.stop();
                    } else {
                        siradaki = p1.id;
                    }

                    await interaction.editReply({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
                }, 1500); // bot 1.5 saniye düşünüyor efekti
            } else {
                await i.update({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !oyunBitti) {
                oyunBitti = true;
                loglar.push(`\n⏳ **${siradaki === p1.id ? p1.name : p2.name}** zaman aşımına uğradı! Dövüş iptal.`);
                ecoDb.ekle(`cuzdan_${p1.id}`, bahis);
                if (!isPvE) ecoDb.ekle(`cuzdan_${p2.id}`, bahis);
                
                if (isPvE) interaction.editReply({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
                else msgObj.edit({ components: [renderUI()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
            }
        });
    }
};
