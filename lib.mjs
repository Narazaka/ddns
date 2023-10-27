// @ts-check

import { exec } from "child_process";

const cloudFlareApiRoot = "https://api.cloudflare.com/client/v4";

/**
 * @typedef {{name: string; type: string; content: string; ttl?: number; proxied?: boolean}} DnsUpdateOptions
 */

/**
 * @typedef {DnsUpdateOptions & {ttl: number; proxied: boolean}} DnsCreateOptions
 */

/**
 * @typedef {{apiToken: string; ip4?: boolean; ip6?: boolean} & DnsUpdateOptions} DnsItem
 */

/**
 * @param {string} apiToken
 */
export const genCloudFlareApi = (apiToken) => {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  return {
    /**
     * 
     * @param {string} name 
     * @returns {Promise<string>}
     */
    async getZoneId(name) {
      const res = await fetch(`${cloudFlareApiRoot}/zones?name=${name}`, { headers });
      const { result } = await res.json();
      return result.find(item => item.name === name).id;
    },
    /**
     * 
     * @param {string} zoneId 
     * @param {{name: string; type: string}} options
     * @returns {Promise<string | undefined>}
     */
    async getDnsRecordId(zoneId, { name, type }) {
      const res = await fetch(`${cloudFlareApiRoot}/zones/${zoneId}/dns_records?name=${name}&type=${type}`, { headers });
      const { result } = await res.json();
      return result.find(item => item.name === name && item.type === type)?.id;
    },
    /**
     * 
     * @param {string} zoneId 
     * @param {string} dnsRecordId 
     * @param {DnsCreateOptions} options
     * @returns 
     */
    async patchDnsRecord(zoneId, dnsRecordId, { name, type, content, ttl, proxied }) {
      const res = await fetch(`${cloudFlareApiRoot}/zones/${zoneId}/dns_records/${dnsRecordId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name, type, content, ttl, proxied }),
      });
      return await res;
    },
    /**
     * 
     * @param {string} zoneId 
     * @param {DnsUpdateOptions} options 
     * @returns 
     */
    async postDnsRecord(zoneId, { name, type, content, ttl = 120, proxied = true }) {
      const res = await fetch(`${cloudFlareApiRoot}/zones/${zoneId}/dns_records`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, type, content, ttl, proxied }),
      });
      return await res;
    },
    /**
     * 
     * @param {DnsUpdateOptions} options 
     * @returns 
     */
    async updateDnsRecord({ name, type, content, ttl = 120, proxied = true }) {
      const sld = name.replace(/^.+?\.([^.]+\.[^.]+)$/, "$1");
      const zoneId = await this.getZoneId(sld);
      const dnsRecordId = await this.getDnsRecordId(zoneId, { name, type });
      if (dnsRecordId) {
        return await this.patchDnsRecord(zoneId, dnsRecordId, { name, type, content, ttl, proxied });
      } else {
        return await this.postDnsRecord(zoneId, { name, type, content, ttl, proxied });
      }
    },
  };
};

export const getIp4 = async () => (await (await fetch("https://checkip.amazonaws.com")).text()).trim();
/**
 * 
 * @returns {Promise<string>}
 */
export const getIp6 = async () => new Promise((resolve, reject) => exec("ip addr show enp1s0 | grep inet6 | awk '{ print $2 }' | sed -n '/^fe80/!p' | sed 's/\\/64$//'", (err, stdout, stderr) => err ? reject(err) : resolve(stdout.trim())));
export const getIp = async () => ({ ip4: await getIp4(), ip6: await getIp6() });

/**
 * 
 * @param {string} apiToken 
 * @param {DnsItem} options 
 * @param {{ip4: string; ip6: string}} ips 
 * @returns 
 */
export const updateCloudFlareDnsRecord = async (apiToken, options, { ip4, ip6 }) => {
  const api = genCloudFlareApi(apiToken);
  const result = {};
  if (ip4 && options.ip4 !== false) result.ip4 = await api.updateDnsRecord({ ...options, type: "A", content: ip4 });
  if (ip6 && options.ip6 !== false) result.ip6 = await api.updateDnsRecord({ ...options, type: "AAAA", content: ip6 });
  return result;
};

/**
 * 
 * @param {DnsItem[]} items 
 * @param {boolean} [debug]
 */
export const updateCloudFlareDnsRecords = async (items, debug) => {
  const ip = await getIp();
  if (debug) console.log(ip);
  for (const item of items) {
    const result = await updateCloudFlareDnsRecord(item.apiToken, item, ip);
    if (debug) console.log(item, result);
  }
};
