<template>
    <div class="page">
        <div class="bar">
            <text class="back" @click="close">‹ 返回</text>
            <text class="bar-title">设置</text>
            <text class="bar-right">v{{ version }}</text>
        </div>

        <div class="body">
            <div class="card">
                <text class="card-title">安全</text>
                <div class="item" @click="togglePin">
                    <div class="item-text">
                        <text class="item-name">{{ hasPin ? 'PIN 保护已开启' : '开启 PIN 保护' }}</text>
                        <text class="item-sub">{{ hasPin ? '账号密钥使用 AES-256 加密存储' : '用 PIN 派生密钥加密本地密钥（推荐）' }}</text>
                    </div>
                    <text class="switch" :class="{ 'switch-on': hasPin }">{{ hasPin ? '关闭' : '开启' }}</text>
                </div>
                <div class="item" @click="lockNow">
                    <div class="item-text">
                        <text class="item-name">立即锁定</text>
                        <text class="item-sub">清除内存中的密钥，下次进入需重新输入 PIN</text>
                    </div>
                    <text class="chev">›</text>
                </div>
            </div>

            <div class="card">
                <text class="card-title">备份</text>
                <div class="item" @click="exportBackup">
                    <div class="item-text">
                        <text class="item-name">导出到文件</text>
                        <text class="item-sub">{{ exportHint }}</text>
                    </div>
                    <text class="chev">›</text>
                </div>
                <div class="item" @click="importBackup">
                    <div class="item-text">
                        <text class="item-name">从 import.txt 导入</text>
                        <text class="item-sub">{{ importHint }}</text>
                    </div>
                    <text class="chev">›</text>
                </div>
            </div>

            <div class="card">
                <text class="card-title">关于</text>
                <div class="item">
                    <div class="item-text">
                        <text class="item-name">Authenticator for 有道词典笔</text>
                        <text class="item-sub">支持 TOTP/HOTP · SHA1/256/512 · 本地加密 · 扫码或手输</text>
                    </div>
                </div>
            </div>
        </div>

        <div class="pin-mask" v-if="pinStage">
            <div class="pin-box">
                <text class="pin-title">{{ pinStage === 'set' ? '设置 6 位数字 PIN' : '再次输入以确认' }}</text>
                <text class="pin-dots">{{ pinDots }}</text>
                <div class="pin-pad">
                    <text v-for="n in 9" :key="n" class="pin-key" @click="pinInput(String(n))">{{ n }}</text>
                    <text class="pin-key" @click="pinInput('del')">←</text>
                    <text class="pin-key" @click="pinInput('0')">0</text>
                    <text class="pin-key" @click="pinStage = ''">取消</text>
                </div>
            </div>
        </div>

        <div v-if="banner" class="banner">{{ banner }}</div>
    </div>
</template>

<script>
import { vault } from '../../lib/vault.js'
import { buildOtpUri, extractUris, parseOtpInput } from '../../lib/otpauth.js'
import { utf8, bytesToBase64 } from '../../lib/bytes.js'
import fs from 'fs'
import globalModule from 'global'

const EXPORT_DIR = '/userdisk/Authenticator'
const IMPORT_PATH = EXPORT_DIR + '/import.txt'

export default {
    name: 'settings',
    data() {
        return {
            hasPin: false,
            version: '1.0.0',
            banner: '',
            exportHint: '生成 otpauth 链接文件，可用 SSH 取走',
            importHint: '逐行写入 import.txt 后点此导入',
            pinStage: '',
            pinBuffer: '',
            pinFirst: ''
        }
    },
    computed: {
        pinDots() {
            let text = ''
            for (let i = 0; i < 6; i++) text += i < this.pinBuffer.length ? '● ' : '○ '
            return text
        }
    },
    mounted() {
        this.boot()
    },
    methods: {
        async boot() {
            await vault.init()
            this.hasPin = vault.hasPin
        },
        close() {
            try {
                this.$page.finish()
            } catch (e) {
                $falcon.closePageByName('settings')
            }
        },
        setBanner(text, delay = 2600) {
            this.banner = text
            if (this._bannerTimer) clearTimeout(this._bannerTimer)
            this._bannerTimer = setTimeout(() => { this.banner = '' }, delay)
        },
        toast(text) {
            this.setBanner(text, 2000)
        },
        async togglePin() {
            if (!vault.unlocked) {
                this.toast('请先解锁')
                return
            }
            if (this.hasPin) {
                await vault.clearPin()
                this.hasPin = false
                this.toast('已关闭 PIN 保护，密钥以明文保存在本机')
            } else {
                this.pinStage = 'set'
                this.pinBuffer = ''
                this.pinFirst = ''
            }
        },
        pinInput(key) {
            if (key === 'del') {
                this.pinBuffer = this.pinBuffer.slice(0, -1)
                this.$forceUpdate()
                return
            }
            if (this.pinBuffer.length >= 6) return
            this.pinBuffer += key
            this.$forceUpdate()
            if (this.pinBuffer.length === 6) {
                const pin = this.pinBuffer
                this.pinBuffer = ''
                if (!this.pinFirst) {
                    this.pinFirst = pin
                    this.pinStage = 'confirm'
                    this.$forceUpdate()
                } else if (this.pinFirst === pin) {
                    this.pinStage = ''
                    vault.setPin(pin).then(() => {
                        this.hasPin = true
                        this.toast('PIN 已开启，请牢记；忘记将无法恢复密钥')
                    }).catch(e => this.toast('设置失败：' + e.message))
                } else {
                    this.pinFirst = ''
                    this.pinStage = ''
                    this.toast('两次输入不一致，请重试')
                }
            }
        },
        async lockNow() {
            if (!vault.hasPin) {
                this.toast('未开启 PIN 保护')
                return
            }
            vault.lock()
            $falcon.navTo('unlock')
        },
        async exportBackup() {
            const items = vault.list()
            if (!items.length) {
                this.toast('没有可导出的账号')
                return
            }
            const text = items.map(buildOtpUri).join('\n') + '\n'
            const b64 = bytesToBase64(utf8(text))
            const stamp = this.stamp()
            const path = `${EXPORT_DIR}/backup-${stamp}.txt`
            const g = new globalModule.Global()
            try {
                g.execShell(`mkdir -p ${EXPORT_DIR} && echo '${b64}' | base64 -d > ${path}`)
                await new Promise(r => setTimeout(r, 700))
                const exists = await fs.exists(path)
                if (exists) {
                    this.exportHint = `已导出 ${items.length} 个账号：${path}`
                    this.toast('已导出：' + path)
                } else {
                    this.toast('导出命令已提交，请稍后到 ' + path + ' 查看')
                }
            } catch (e) {
                this.toast('导出失败：' + e.message)
            }
        },
        async importBackup() {
            try {
                const exists = await fs.exists(IMPORT_PATH)
                if (!exists) {
                    this.toast('未找到 ' + IMPORT_PATH + '，请先用 SSH 放入文件')
                    return
                }
                const text = await fs.readFile(IMPORT_PATH)
                const uris = extractUris(text)
                if (!uris.length) {
                    this.toast('文件里没有 otpauth 链接')
                    return
                }
                let added = 0
                let skipped = 0
                for (const uri of uris) {
                    try {
                        const parsed = parseOtpInput(uri)
                        if (vault.hasDuplicate(parsed.secret)) {
                            skipped++
                            continue
                        }
                        await vault.add(parsed)
                        added++
                    } catch (e) {
                        skipped++
                    }
                }
                this.importHint = `导入 ${added} 个，跳过 ${skipped} 个`
                this.toast(`导入完成：新增 ${added} 个，跳过 ${skipped} 个`)
            } catch (e) {
                this.toast('导入失败：' + e.message)
            }
        },
        stamp() {
            const d = new Date()
            const p = n => (n < 10 ? '0' + n : '' + n)
            return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
        }
    }
}
</script>

<style lang="less" scoped>
.page {
    flex: 1;
    flex-direction: column;
    background-color: #f2f4f7;
}

.bar {
    height: 44px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background-color: #ffffff;
    border-bottom-width: 1px;
    border-bottom-color: #e6e8eb;
}

.back {
    font-size: 14px;
    color: #1a73e8;
    width: 70px;
}

.bar-title {
    font-size: 15px;
    color: #1b1c1e;
    font-weight: bold;
}

.bar-right {
    font-size: 11px;
    color: #9aa0a6;
    width: 70px;
    text-align: right;
}

.body {
    flex: 1;
    flex-direction: row;
    padding: 8px;
}

.card {
    flex: 1;
    flex-direction: column;
    background-color: #ffffff;
    border-radius: 10px;
    padding: 8px 10px;
    margin-right: 8px;
}

.card-title {
    font-size: 12px;
    color: #8a8f98;
    margin-bottom: 4px;
}

.item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 6px 2px;
}

.item-text {
    flex: 1;
    flex-direction: column;
}

.item-name {
    font-size: 13px;
    color: #1b1c1e;
}

.item-sub {
    font-size: 11px;
    color: #9aa0a6;
    margin-top: 1px;
}

.switch {
    font-size: 11px;
    color: #ffffff;
    background-color: #1a73e8;
    padding: 5px 10px;
    border-radius: 11px;
}

.switch-on {
    background-color: #d93025;
}

.chev {
    font-size: 16px;
    color: #c4c7cc;
}

.pin-mask {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background-color: rgba(22, 24, 28, 0.55);
    align-items: center;
    justify-content: center;
}

.pin-box {
    width: 300px;
    background-color: #ffffff;
    border-radius: 14px;
    padding: 12px;
    flex-direction: column;
    align-items: center;
}

.pin-title {
    font-size: 13px;
    color: #1b1c1e;
}

.pin-dots {
    font-size: 20px;
    color: #1a73e8;
    margin: 8px 0;
    letter-spacing: 2px;
}

.pin-pad {
    flex-direction: row;
    flex-wrap: wrap;
    width: 270px;
}

.pin-key {
    width: 84px;
    height: 34px;
    font-size: 15px;
    color: #1b1c1e;
    background-color: #f1f3f4;
    text-align: center;
    line-height: 34px;
    margin: 3px;
    border-radius: 8px;
}

.banner {
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: 10px;
    font-size: 12px;
    color: #ffffff;
    background-color: rgba(32, 33, 36, 0.86);
    padding: 7px 12px;
    border-radius: 16px;
    text-align: center;
}
</style>
