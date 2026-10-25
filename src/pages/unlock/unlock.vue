<template>
    <div class="page">
        <div class="left">
            <div class="lock">
                <div class="lock-shackle"></div>
                <div class="lock-body"></div>
            </div>
            <text class="title">验证器已锁定</text>
            <text class="sub">输入 {{ pinLength }} 位 PIN 解锁</text>
            <text class="dots">{{ dots }}</text>
            <text class="error">{{ error }}</text>
        </div>

        <div class="pad">
            <text v-for="n in 9" :key="n" class="key" @click="input(String(n))">{{ n }}</text>
            <text class="key key-aux" @click="input('del')">←</text>
            <text class="key" @click="input('0')">0</text>
            <text class="key key-aux" @click="onBack">返回</text>
        </div>

        <div class="reset" v-if="showReset">
            <text class="reset-link" @click="resetAll">忘记 PIN？清除全部账号重新开始</text>
        </div>
    </div>
</template>

<script>
import { vault } from '../../lib/vault.js'

export default {
    name: 'unlock',
    data() {
        return {
            pin: '',
            error: '',
            pinLength: 6,
            showReset: false,
            busy: false
        }
    },
    computed: {
        dots() {
            let text = ''
            for (let i = 0; i < this.pinLength; i++) text += i < this.pin.length ? '● ' : '○ '
            return text
        }
    },
    mounted() {
        this.boot()
    },
    methods: {
        async boot() {
            await vault.init()
            if (!vault.hasPin) {
                this.leave()
            }
        },
        input(key) {
            if (this.busy) return
            if (key === 'del') {
                this.pin = this.pin.slice(0, -1)
                this.error = ''
                this.$forceUpdate()
                return
            }
            if (this.pin.length >= this.pinLength) return
            this.pin += key
            this.$forceUpdate()
            if (this.pin.length === this.pinLength) this.submit()
        },
        async submit() {
            this.busy = true
            try {
                await vault.unlock(this.pin)
                this.pin = ''
                this.error = ''
                this.leave()
            } catch (e) {
                this.error = e.message || '解锁失败'
                this.pin = ''
                this.showReset = true
            } finally {
                this.busy = false
                this.$forceUpdate()
            }
        },
        leave() {
            try {
                this.$page.finish()
            } catch (e) {
                $falcon.navTo('index')
            }
        },
        onBack() {
            this.leave()
        },
        async resetAll() {
            if (this._confirmReset) {
                vault.lock()
                vault.meta = { pin: false, salt: '', iterations: 150, accounts: [] }
                vault.accounts = []
                await vault.persist()
                $falcon.navTo('index')
                return
            }
            this._confirmReset = true
            this.error = '再点一次将清除所有账号（不可恢复）'
        }
    }
}
</script>

<style lang="less" scoped>
.page {
    flex: 1;
    flex-direction: row;
    background-color: #f2f4f7;
}

.left {
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-left: 40px;
}

.lock {
    width: 34px;
    height: 38px;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 8px;
}

.lock-shackle {
    width: 20px;
    height: 14px;
    border-width: 3px;
    border-color: #1a73e8;
    border-radius: 10px;
    margin-bottom: -4px;
}

.lock-body {
    width: 34px;
    height: 24px;
    background-color: #1a73e8;
    border-radius: 6px;
}

.title {
    font-size: 20px;
    color: #1b1c1e;
    font-weight: bold;
}

.sub {
    font-size: 12px;
    color: #8a8f98;
    margin-top: 4px;
}

.dots {
    font-size: 22px;
    color: #1a73e8;
    margin-top: 14px;
    letter-spacing: 3px;
}

.error {
    font-size: 12px;
    color: #d93025;
    margin-top: 10px;
    max-width: 380px;
    text-align: center;
}

.pad {
    width: 348px;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    padding: 4px;
}

.key {
    width: 104px;
    height: 56px;
    font-size: 22px;
    color: #1b1c1e;
    background-color: #ffffff;
    text-align: center;
    line-height: 56px;
    margin: 4px;
    border-radius: 12px;
}

.key-aux {
    font-size: 16px;
    color: #5f6368;
    background-color: #e8eaed;
}

.reset {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8px;
    align-items: center;
}

.reset-link {
    font-size: 11px;
    color: #d93025;
    text-align: center;
}
</style>
