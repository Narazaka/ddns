import { exec } from "child_process";

const cloudFlareApiRoot = "https://api.cloudflare.com/client/v4";

export const genCloudFlareApi = (apiToken) => {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  return {
    async getZoneId(name) {
      const res = await fetch(`${cloudFlareApiRoot}/zones?name=${name}`, { headers });
      const { result } = await res.json();
      return result.find(item => item.name === name)?.id;
    },
    async getDnsRecordId(zoneId, { name, type }) {
      const res = await fetch(`${cloudFlareApiRoot}/zones/${zoneId}/dns_records?name=${name}&type=${type}`, { headers });
      const { result } = await res.json();
      return result.find(item => item.name === name && item.type === type)?.id;
    },
    async patchDnsRecord(zoneId, dnsRecordId, { name, type, content, ttl, proxied }) {
      const res = await fetch(`${cloudFlareApiRoot}/zones/${zoneId}/dns_records/${dnsRecordId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name, type, content, ttl, proxied }),
      });
      return await res;
    },
    async postDnsRecord(zoneId, { name, type, content, ttl = 120, proxied = true }) {
      const res = await fetch(`${cloudFlareApiRoot}/zones/${zoneId}/dns_records`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, type, content, ttl, proxied }),
      });
      return await res;
    },
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
export const getIp6 = async () => new Promise((resolve, reject) => exec("ifconfig -a eno1 | grep inet6 | awk '{ print $2 }' | sed -n '/^fe80/!p'", (err, stdout, stderr) => err ? reject(err) : resolve(stdout.trim())));
export const getIp = async () => ({ ip4: await getIp4(), ip6: await getIp6() });

export const updateCloudFlareDnsRecord = async (apiToken, options, { ip4, ip6 }) => {
  const api = genCloudFlareApi(apiToken);
  const result = {};
  if (ip4 && options.ip4 !== false) result.ip4 = await api.updateDnsRecord({ ...options, type: "A", content: ip4 });
  if (ip6 && options.ip6 !== false) result.ip6 = await api.updateDnsRecord({ ...options, type: "AAAA", content: ip6 });
  return result;
};

export const updateCloudFlareDnsRecords = async (items, debug) => {
  const ip = await getIp();
  if (debug) console.log(ip);
  for (const item of items) {
    const result = await updateCloudFlareDnsRecord(item.apiToken, item, ip);
    if (debug) console.log(item, result);
  }
};
