class Contact {
    constructor(id, name, avatar, age, generation, interests, online = false) {
        this.id = id;
        this.name = name;
        this.avatar = avatar;
        this.age = age;
        this.generation = generation;
        this.interests = interests;
        this.online = online;
    }
}

// Expose globally for non-module script tags
window.Contact = Contact;
