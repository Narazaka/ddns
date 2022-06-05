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
      const zoneId = await this.getZoneId(name);
      const dnsRecordId = await this.getDnsRecordId(zoneId, { name, type });
      if (dnsRecordId) {
        return await this.patchDnsRecord(zoneId, dnsRecordId, { name, type, content, ttl, proxied });
      } else {
        return await this.postDnsRecord(zoneId, { name, type, content, ttl, proxied });
      }
    },
  };
};

export const getIp4 = async () => await (await fetch("https://checkip.amazonaws.com")).text();
export const getIp6 = async () => new Promise((resolve, reject) => exec("ifconfig -a eno1 | grep inet6 | awk '{ print $2 }' | sed -n '/^fe80/!p'", (err, stdout, stderr) => err ? reject(err) : resolve(stdout.trim()));
export const getIp = async () => ({ ip4: await getIp4(), ip6: await getIp6() });

export const updateCloudFlareDnsRecord = async (name, apiToken, { ip4, ip6 }) => {
  const api = genCloudFlareApi(apiToken);
  if (ip4) await api.updateDnsRecord({ name, type: "A", content: ip4 });
  if (ip6) await api.updateDnsRecord({ name, type: "AAAA", content: ip6 });
};

export const updateCloudFlareDnsRecords = async (items) => {
  const ip = await getIp();
  for (const { name, apiToken } of items) {
    await updateCloudFlareDnsRecord(name, apiToken, ip);
  }
};
